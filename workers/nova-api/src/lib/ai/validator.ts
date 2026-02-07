/**
 * Validator — checks plan results for consistency and quality.
 * Skipped for simple plans (1-2 steps, requiresValidation === false).
 */

import type { ExecutionPlan } from './planner.js';
import type { StepResult } from './executor.js';

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

interface ValidatorEnv {
  ANTHROPIC_API_KEY: string;
}

export async function validateResults(
  plan: ExecutionPlan,
  results: StepResult[],
  env: ValidatorEnv,
): Promise<ValidationResult> {
  // Skip validation for simple plans
  if (!plan.requiresValidation || plan.steps.length <= 2) {
    const errors = results.filter((r) => r.status === 'error');
    return {
      passed: errors.length === 0,
      issues: errors.map((e) => `Step ${e.stepId} failed: ${e.result}`),
      suggestions: [],
    };
  }

  const planSummary = `Intent: ${plan.intent}\nSteps: ${plan.steps.map((s) => `${s.id}: ${s.description}`).join('\n')}`;
  const resultsSummary = results
    .map((r) => `Step ${r.stepId} (${r.toolName || 'reasoning'}): ${r.status} — ${r.result.slice(0, 300)}`)
    .join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: 'You validate AI execution results. Return a JSON object with: passed (boolean), issues (string array of problems found), suggestions (string array of improvements). Be concise.',
      messages: [
        {
          role: 'user',
          content: `Plan:\n${planSummary}\n\nResults:\n${resultsSummary}\n\nCheck for: errors, incomplete actions, inconsistencies. Return JSON.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { passed: results.every((r) => r.status === 'success'), issues: [], suggestions: [] };
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = data.content.find((b) => b.type === 'text')?.text || '';

  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ValidationResult;
      return {
        passed: parsed.passed ?? true,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    }
  } catch {
    // Fall through
  }

  return {
    passed: results.every((r) => r.status === 'success'),
    issues: [],
    suggestions: [],
  };
}
