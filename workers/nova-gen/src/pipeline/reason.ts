import type { IntentClassification, ReasoningResult, SelectedBlock, SessionContext } from '@nova/shared-types';
import type { ModelFactory } from '../lib/model-factory.js';
import type { BlockCatalogEntry } from '../blocks/registry.js';

/**
 * Stage 2: Reasoning Engine (Claude — deep analysis)
 * Selects blocks, orders them, and provides rationale.
 * Uses value scores to weight block selection.
 */
export async function analyzeAndSelectBlocks(
  query: string,
  intent: IntentClassification,
  blockCatalog: BlockCatalogEntry[],
  ragContext: string,
  modelFactory: ModelFactory,
  env: { ANTHROPIC_API_KEY?: string; CEREBRAS_API_KEY?: string },
  sessionContext?: SessionContext,
  valueScores?: Record<string, number>,
): Promise<ReasoningResult> {
  const catalogDescription = blockCatalog
    .map((b) => {
      const valueHint = valueScores?.[b.name] ? ` (value score: ${valueScores[b.name]})` : '';
      return `- ${b.name} (${b.category}): ${b.whenToUse}${valueHint}`;
    })
    .join('\n');

  const sessionInfo = sessionContext?.previousQueries?.length
    ? `\nUser journey: ${sessionContext.previousQueries.map((q) => `${q.intentType}: "${q.query}"`).join(' → ')}`
    : '';

  const result = await modelFactory.call(
    'reasoning',
    [
      {
        role: 'system',
        content: `You are a content strategist selecting the best blocks for a webpage.
Given the user's intent and available blocks, select and order blocks for maximum engagement.

Available blocks:
${catalogDescription}

Context from content repository:
${ragContext}
${sessionInfo}

Respond in JSON:
{
  "selectedBlocks": [
    { "type": "block-name", "reason": "why this block", "sectionStyle": "optional-css", "priority": 1-10 }
  ],
  "rationale": "overall reasoning",
  "confidence": { "intent": 0.0-1.0, "contentMatch": 0.0-1.0 },
  "followUpSuggestions": ["suggestion1", "suggestion2"]
}`,
      },
      {
        role: 'user',
        content: `Query: "${query}"\nIntent: ${intent.intentType} (confidence: ${intent.confidence})\nEntities: ${intent.entities.join(', ')}\nJourney stage: ${intent.journeyStage}`,
      },
    ],
    env,
  );

  try {
    return JSON.parse(result.content) as ReasoningResult;
  } catch {
    return {
      selectedBlocks: [{ type: 'hero', reason: 'Default fallback', priority: 1 }],
      rationale: 'Could not parse reasoning result, using fallback.',
      confidence: { intent: 0.3, contentMatch: 0.3 },
    };
  }
}
