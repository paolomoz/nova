import type { IntentClassification, SessionContext } from '@nova/shared-types';
import type { ModelFactory } from '../lib/model-factory.js';

/**
 * Stage 1: Intent Classification (fast model — Cerebras)
 * Classifies user query into intent type, extracts entities, determines journey stage.
 * Configurable intent types per project.
 */
export async function classifyIntent(
  query: string,
  modelFactory: ModelFactory,
  env: { ANTHROPIC_API_KEY?: string; CEREBRAS_API_KEY?: string },
  sessionContext?: SessionContext,
  intentTypes?: string[],
): Promise<IntentClassification> {
  const availableIntents = intentTypes?.length
    ? intentTypes.join(', ')
    : 'discovery, comparison, detail, support, general';

  const previousContext = sessionContext?.previousQueries?.length
    ? `Previous queries: ${sessionContext.previousQueries.map((q) => q.query).join('; ')}`
    : '';

  const result = await modelFactory.call(
    'classification',
    [
      {
        role: 'system',
        content: `You are an intent classifier. Classify the user query into one of these intent types: ${availableIntents}.
Extract key entities and determine the journey stage (exploring, comparing, deciding, supporting).
${previousContext}

Respond in JSON only:
{
  "intentType": "string",
  "entities": ["string"],
  "journeyStage": "exploring|comparing|deciding|supporting",
  "confidence": 0.0-1.0
}`,
      },
      { role: 'user', content: query },
    ],
    env,
  );

  try {
    return JSON.parse(result.content) as IntentClassification;
  } catch {
    return {
      intentType: 'general',
      entities: [],
      journeyStage: 'exploring',
      confidence: 0.5,
    };
  }
}
