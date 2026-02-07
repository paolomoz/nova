import type { SessionContext } from '@nova/shared-types';
import type { SSECallback } from '../lib/sse.js';
import { ModelFactory } from '../lib/model-factory.js';
import { classifyIntent } from './classify.js';
import { analyzeAndSelectBlocks } from './reason.js';
import { generateBlocks } from './generate.js';
import { getBlockCatalog } from '../blocks/registry.js';
import { getRAGContext } from '../context/rag.js';

interface PipelineEnv {
  ANTHROPIC_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  VOYAGE_API_KEY?: string;
  VOYAGE_MODEL?: string;
  MODEL_PRESET?: string;
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
  DA_CLIENT_ID?: string;
  DA_CLIENT_SECRET?: string;
  DA_SERVICE_TOKEN?: string;
  DA_ADMIN_HOST?: string;
}

interface PipelineParams {
  query: string;
  projectId: string;
  env: PipelineEnv;
  write: SSECallback;
  sessionContext?: SessionContext;
  intentTypes?: string[];
  brandVoice?: string;
  brandProfile?: BrandProfile;
  persistPath?: string;
  hybridScaffold?: string;
}

interface BrandProfile {
  voice?: Record<string, unknown>;
  visual?: Record<string, unknown>;
  contentRules?: Record<string, unknown>;
  designTokens?: Record<string, unknown>;
}

export interface PipelineResult {
  htmlBlocks: string[];
  fullHtml: string;
  persistedPath?: string;
  intent: string;
  duration: number;
}

/**
 * Main pipeline orchestrator — generalized from vitamix-gensite.
 *
 * Pipeline stages:
 * 1. Fast Classification (Cerebras) — classify user intent
 * 2. Deep Reasoning (Claude) — select blocks with rationale
 * 3. Content Generation (Cerebras) — parallel block generation with SSE streaming
 * 4. Optional: Page persistence to DA
 */
export async function orchestrate(params: PipelineParams): Promise<PipelineResult> {
  const {
    query, projectId, env, write, sessionContext,
    intentTypes, brandVoice, brandProfile, persistPath, hybridScaffold,
  } = params;
  const startTime = Date.now();
  const modelFactory = new ModelFactory(env.MODEL_PRESET || 'production');

  write({ event: 'generation-start', data: { query, estimatedBlocks: 5 } });

  // Stage 1: Classification
  write({ event: 'reasoning-start', data: { stage: 'classification' } });
  const intent = await classifyIntent(query, modelFactory, env, sessionContext, intentTypes);
  write({
    event: 'reasoning-step',
    data: {
      stage: 'classification',
      title: 'Intent Classified',
      content: `${intent.intentType} (confidence: ${intent.confidence})`,
    },
  });

  // Load block catalog for project
  const blockCatalog = await getBlockCatalog(projectId, env.DB);

  // Get RAG context from Vectorize (real embedding search)
  const ragContext = await getRAGContext(
    query, projectId, env.VECTORIZE, env.VOYAGE_API_KEY, env.VOYAGE_MODEL,
  );

  // Load brand profile from D1 if not provided
  let effectiveBrandVoice = brandVoice || '';
  if (!effectiveBrandVoice && brandProfile?.voice) {
    const v = brandProfile.voice;
    effectiveBrandVoice = `Tone: ${v.tone || 'professional'}. Personality: ${v.personality || 'helpful'}. ${v.guidelines || ''}`;
  }
  if (!effectiveBrandVoice && env.DB) {
    try {
      const bp = await env.DB.prepare(
        'SELECT voice, content_rules FROM brand_profiles WHERE project_id = ? LIMIT 1',
      ).bind(projectId).first();
      if (bp) {
        const voice = JSON.parse((bp.voice as string) || '{}');
        const rules = JSON.parse((bp.content_rules as string) || '{}');
        effectiveBrandVoice = `Tone: ${voice.tone || 'professional'}. ${voice.guidelines || ''} ${rules.guidelines || ''}`.trim();
      }
    } catch { /* non-fatal */ }
  }

  // Load value scores for block weighting
  let valueScores: Record<string, number> = {};
  if (env.DB) {
    try {
      const { results } = await env.DB
        .prepare(
          `SELECT bl.name, AVG(vs.composite_score) as avg_score
           FROM block_library bl
           LEFT JOIN value_scores vs ON vs.project_id = bl.project_id
           WHERE bl.project_id = ?
           GROUP BY bl.name`,
        )
        .bind(projectId)
        .all();
      for (const r of results) {
        if (r.name && r.avg_score) {
          valueScores[r.name as string] = r.avg_score as number;
        }
      }
    } catch { /* non-fatal */ }
  }

  // Stage 2: Reasoning
  write({ event: 'reasoning-start', data: { stage: 'reasoning' } });
  const reasoningResult = await analyzeAndSelectBlocks(
    query, intent, blockCatalog, ragContext, modelFactory, env, sessionContext, valueScores,
  );
  write({
    event: 'reasoning-step',
    data: { stage: 'reasoning', title: 'Blocks Selected', content: reasoningResult.rationale },
  });
  write({ event: 'reasoning-complete', data: { confidence: reasoningResult.confidence } });

  // Stage 3: Content Generation
  const htmlBlocks = await generateBlocks(
    reasoningResult.selectedBlocks, query, ragContext, modelFactory, env, write, effectiveBrandVoice,
  );

  // Build full page HTML
  let fullHtml: string;
  if (hybridScaffold) {
    // Hybrid mode: inject generated blocks into scaffold's generative zones
    fullHtml = hybridScaffold.replace(
      /<!--\s*generative-zone\s*-->/gi,
      htmlBlocks.join('\n<hr>\n'),
    );
  } else {
    fullHtml = htmlBlocks.join('\n<hr>\n');
  }

  // Page persistence to DA (if path specified)
  let persistedPath: string | undefined;
  if (persistPath && env.DA_SERVICE_TOKEN) {
    try {
      write({ event: 'persist-start', data: { path: persistPath } });
      const daHost = env.DA_ADMIN_HOST || 'https://admin.da.live';
      const persistResponse = await fetch(`${daHost}/source`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DA_SERVICE_TOKEN}`,
        },
        body: JSON.stringify({ path: persistPath, content: fullHtml }),
      });
      if (persistResponse.ok) {
        persistedPath = persistPath;
        write({ event: 'persist-complete', data: { path: persistPath } });
      }
    } catch { /* non-fatal */ }
  }

  // Log generation to D1
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO action_history (id, user_id, project_id, action_type, description, input, output, status)
         VALUES (?, 'system', ?, 'ai_generate', ?, ?, ?, 'completed')`,
      ).bind(
        crypto.randomUUID(),
        projectId,
        `Generated ${htmlBlocks.length} blocks for: ${query.slice(0, 100)}`,
        JSON.stringify({ query, intent: intent.intentType }),
        JSON.stringify({ blocks: htmlBlocks.length, persisted: persistedPath || null }),
      ).run();
    } catch { /* non-fatal */ }
  }

  const duration = Date.now() - startTime;
  write({
    event: 'generation-complete',
    data: {
      totalBlocks: htmlBlocks.length,
      duration,
      intent: intent.intentType,
      confidence: reasoningResult.confidence,
      followUpSuggestions: reasoningResult.followUpSuggestions,
      persistedPath,
    },
  });

  return { htmlBlocks, fullHtml, persistedPath, intent: intent.intentType, duration };
}
