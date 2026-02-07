import type { SessionContext } from '@nova/shared-types';
import type { SSECallback } from '../lib/sse.js';
import { ModelFactory } from '../lib/model-factory.js';
import { classifyIntent } from './classify.js';
import { analyzeAndSelectBlocks } from './reason.js';
import { generateBlocks } from './generate.js';
import { getBlockCatalog } from '../blocks/registry.js';

interface PipelineEnv {
  ANTHROPIC_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  MODEL_PRESET?: string;
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
}

interface PipelineParams {
  query: string;
  projectId: string;
  env: PipelineEnv;
  write: SSECallback;
  sessionContext?: SessionContext;
  intentTypes?: string[];
  brandVoice?: string;
}

/**
 * Main pipeline orchestrator — ported from vitamix-gensite.
 * Generalized to work with any project's block catalog and intent types.
 *
 * Pipeline stages:
 * 1. Fast Classification (Cerebras) — classify user intent
 * 2. Deep Reasoning (Claude) — select blocks with rationale
 * 3. Content Generation (Cerebras) — parallel block generation with SSE streaming
 */
export async function orchestrate(params: PipelineParams): Promise<void> {
  const { query, projectId, env, write, sessionContext, intentTypes, brandVoice } = params;
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

  // Get RAG context from Vectorize
  let ragContext = '';
  if (env.VECTORIZE) {
    try {
      // Phase 3: proper embedding-based retrieval
      ragContext = 'No RAG context available yet.';
    } catch {
      ragContext = '';
    }
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
    } catch {
      // Non-fatal
    }
  }

  // Stage 2: Reasoning
  write({ event: 'reasoning-start', data: { stage: 'reasoning' } });
  const reasoningResult = await analyzeAndSelectBlocks(
    query,
    intent,
    blockCatalog,
    ragContext,
    modelFactory,
    env,
    sessionContext,
    valueScores,
  );
  write({
    event: 'reasoning-step',
    data: {
      stage: 'reasoning',
      title: 'Blocks Selected',
      content: reasoningResult.rationale,
    },
  });
  write({
    event: 'reasoning-complete',
    data: { confidence: reasoningResult.confidence },
  });

  // Stage 3: Content Generation
  const htmlBlocks = await generateBlocks(
    reasoningResult.selectedBlocks,
    query,
    ragContext,
    modelFactory,
    env,
    write,
    brandVoice,
  );

  const duration = Date.now() - startTime;
  write({
    event: 'generation-complete',
    data: {
      totalBlocks: htmlBlocks.length,
      duration,
      intent: intent.intentType,
      confidence: reasoningResult.confidence,
      followUpSuggestions: reasoningResult.followUpSuggestions,
    },
  });
}
