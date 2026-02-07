/**
 * Executor — walks a plan's steps in dependency order, executing tools or reasoning.
 */

import type { ExecutionPlan, PlanStep } from './planner.js';
import { executeTool, type ToolContext } from './tools.js';
import type { SSEWriter } from '../sse.js';

export interface StepResult {
  stepId: string;
  status: 'success' | 'error';
  result: string;
  toolName?: string;
}

interface ExecutorEnv {
  ANTHROPIC_API_KEY: string;
}

export async function executePlan(
  plan: ExecutionPlan,
  toolCtx: ToolContext,
  env: ExecutorEnv,
  onProgress?: SSEWriter,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const completedSteps = new Set<string>();

  // Build dependency graph
  const pending = [...plan.steps];
  let maxIterations = pending.length * 2; // Safety limit

  while (pending.length > 0 && maxIterations-- > 0) {
    // Find steps whose dependencies are all completed
    const ready = pending.filter((step) =>
      !step.dependsOn || step.dependsOn.every((dep) => completedSteps.has(dep)),
    );

    if (ready.length === 0) {
      // Deadlock — execute remaining steps in order
      ready.push(pending[0]);
    }

    for (const step of ready) {
      const idx = pending.indexOf(step);
      if (idx !== -1) pending.splice(idx, 1);

      onProgress?.({ event: 'step_start', data: { stepId: step.id, description: step.description, toolName: step.toolName } });

      try {
        let result: string;

        if (step.toolName) {
          // Tool step
          const input = step.toolInput || {};
          onProgress?.({ event: 'tool_call', data: { stepId: step.id, toolName: step.toolName, input } });
          result = await executeTool(step.toolName, input, toolCtx);
        } else {
          // Reasoning step — call Claude with collected context
          result = await executeReasoningStep(step, results, env);
        }

        results.push({ stepId: step.id, status: 'success', result, toolName: step.toolName });
        completedSteps.add(step.id);

        onProgress?.({ event: 'step_complete', data: { stepId: step.id, status: 'success', result: result.slice(0, 500) } });
      } catch (err) {
        const errorMsg = (err as Error).message;
        results.push({ stepId: step.id, status: 'error', result: errorMsg, toolName: step.toolName });
        completedSteps.add(step.id);

        onProgress?.({ event: 'step_complete', data: { stepId: step.id, status: 'error', error: errorMsg } });
      }
    }
  }

  return results;
}

async function executeReasoningStep(
  step: PlanStep,
  priorResults: StepResult[],
  env: ExecutorEnv,
): Promise<string> {
  const contextSummary = priorResults
    .map((r) => `Step ${r.stepId} (${r.toolName || 'reasoning'}): ${r.status} — ${r.result.slice(0, 200)}`)
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
      max_tokens: 2048,
      system: 'You are a reasoning assistant. Analyze the provided context and step description to produce a helpful response.',
      messages: [
        {
          role: 'user',
          content: `Step: ${step.description}\n\nPrior step results:\n${contextSummary || 'None yet.'}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Reasoning step failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}
