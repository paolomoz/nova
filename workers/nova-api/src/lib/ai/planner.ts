/**
 * Planner — decomposes complex prompts into execution plans.
 * Uses Cerebras Llama for fast classification, Claude for plan creation.
 */

import type { RAGContext } from './context.js';
import type { ToolDefinition } from './tools.js';

export interface PlanStep {
  id: string;
  description: string;
  toolName?: string;
  toolInput?: Record<string, string>;
  dependsOn?: string[];
  validation?: string;
}

export interface ExecutionPlan {
  intent: string;
  steps: PlanStep[];
  requiresValidation: boolean;
}

interface PlannerEnv {
  ANTHROPIC_API_KEY: string;
  CEREBRAS_API_KEY: string;
}

/**
 * Fast classification: should this prompt be planned (multi-step) or executed directly (single)?
 * Uses Cerebras Llama for low-latency classification.
 */
export async function shouldPlan(
  prompt: string,
  env: PlannerEnv,
): Promise<'multi' | 'single'> {
  // If no Cerebras key, fall back to heuristic
  if (!env.CEREBRAS_API_KEY) {
    return heuristicClassify(prompt);
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: 'Classify the user request as "multi" (requires multiple steps, tools, or complex reasoning) or "single" (simple one-step action). Respond with only "multi" or "single".',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) return heuristicClassify(prompt);

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const result = data.choices[0]?.message?.content?.trim().toLowerCase();
    return result === 'multi' ? 'multi' : 'single';
  } catch {
    return heuristicClassify(prompt);
  }
}

function heuristicClassify(prompt: string): 'multi' | 'single' {
  const multiIndicators = [
    /\band\b.*\bthen\b/i,
    /\bfirst\b.*\bthen\b/i,
    /\bmultiple\b/i,
    /\beach\b.*\bpage\b/i,
    /\ball\b.*\bpages\b/i,
    /\bcreate.*\band\b.*\b(set|update|configure)/i,
    /\banalyze\b.*\band\b.*\b(fix|improve|suggest)/i,
    /step\s*\d/i,
    /\d+\.\s+/,
  ];
  const matches = multiIndicators.filter((p) => p.test(prompt)).length;
  return matches >= 1 ? 'multi' : 'single';
}

/**
 * Create an execution plan via Claude with a create_plan tool.
 */
export async function createPlan(
  prompt: string,
  context: RAGContext,
  tools: ToolDefinition[],
  env: PlannerEnv,
): Promise<ExecutionPlan> {
  const toolSummary = tools.map((t) => `- ${t.name}: ${t.description.split('\n')[0]}`).join('\n');

  const planTool = {
    name: 'create_plan',
    description: 'Create an execution plan for the user request.',
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: { type: 'string', description: 'Brief description of what the plan accomplishes' },
        steps: {
          type: 'string',
          description: 'JSON array of steps. Each step: { id: string, description: string, toolName?: string, toolInput?: object, dependsOn?: string[], validation?: string }',
        },
        requiresValidation: { type: 'string', description: '"true" or "false" — whether results should be validated after execution' },
      },
      required: ['intent', 'steps', 'requiresValidation'],
    },
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: `You are a planning assistant for an AI CMS. Break down user requests into concrete steps.

Available tools:
${toolSummary}

Context:
- ${context.projectInfo}
- Recent actions: ${context.recentActions}
${context.semanticContext ? `\nRelated content:\n${context.semanticContext}` : ''}
${context.valueInsights ? `\nValue insights:\n${context.valueInsights}` : ''}

Create a plan using the create_plan tool. Each step should use one of the available tools or be a reasoning step (no toolName).
Keep plans concise — prefer fewer steps. Set requiresValidation to true only for plans with 3+ steps that create or modify content.`,
      tools: [planTool],
      tool_choice: { type: 'tool', name: 'create_plan' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Planning failed: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; input?: { intent: string; steps: string; requiresValidation: string } }>;
  };

  const toolUse = data.content.find((b) => b.type === 'tool_use');
  if (!toolUse?.input) {
    throw new Error('Planning did not return a plan');
  }

  const { intent, steps: stepsJson, requiresValidation } = toolUse.input;
  let steps: PlanStep[];
  try {
    steps = JSON.parse(stepsJson);
  } catch {
    throw new Error('Planning returned invalid steps JSON');
  }

  return {
    intent,
    steps,
    requiresValidation: requiresValidation === 'true',
  };
}
