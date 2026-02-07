import type { DAAdminClient } from '@nova/da-client';
import { getToolDefinitions, executeTool, type ToolContext } from './tools.js';
import { buildRAGContext } from './context.js';
import { shouldPlan, createPlan } from './planner.js';
import { executePlan, type StepResult } from './executor.js';
import { validateResults, type ValidationResult } from './validator.js';
import type { SSEWriter } from '../sse.js';

export interface OrchestratorEnv {
  ANTHROPIC_API_KEY: string;
  CEREBRAS_API_KEY: string;
  VOYAGE_API_KEY: string;
  VOYAGE_MODEL: string;
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  EMBED_QUEUE?: Queue;
}

export interface OrchestratorParams {
  prompt: string;
  userId: string;
  projectId: string;
  daClient: DAAdminClient;
  env: OrchestratorEnv;
}

export interface OrchestratorResult {
  response: string;
  toolCalls: Array<{ name: string; input: Record<string, string>; result: string }>;
}

/**
 * AI Orchestrator — Claude tool-use loop (single-turn, backward compat).
 * Sends the user prompt + tools to Claude, executes tool calls, continues until done.
 */
export async function orchestrate(params: OrchestratorParams): Promise<OrchestratorResult> {
  const { prompt, userId, projectId, daClient, env } = params;

  // Build context with semantic + value enrichment
  const context = await buildRAGContext(env.DB, userId, projectId, {
    vectorize: env.VECTORIZE,
    voyageApiKey: env.VOYAGE_API_KEY,
    voyageModel: env.VOYAGE_MODEL,
    query: prompt,
  });

  let systemPrompt = `You are Nova, an AI assistant for content management on AEM Edge Delivery Services.
You help users manage website content through the Document Authoring (DA) API.

Current context:
- ${context.projectInfo}
- Recent actions:
${context.recentActions}`;

  if (context.semanticContext) {
    systemPrompt += `\n\n${context.semanticContext}`;
  }
  if (context.valueInsights) {
    systemPrompt += `\n\nValue insights:\n${context.valueInsights}`;
  }

  systemPrompt += `\n\nYou have tools to list, read, create, delete, search, and analyze pages. Use them to fulfill the user's request.
When creating pages, use clean HTML with EDS block markup. Use get_block_library to check available blocks.
Always confirm what you did after completing an action.`;

  const tools = getToolDefinitions();
  const toolCtx: ToolContext = {
    daClient,
    db: env.DB,
    vectorize: env.VECTORIZE,
    userId,
    projectId,
    voyageApiKey: env.VOYAGE_API_KEY,
    voyageModel: env.VOYAGE_MODEL,
    embedQueue: env.EMBED_QUEUE,
  };

  const messages: Array<Record<string, unknown>> = [
    { role: 'user', content: prompt },
  ];
  const executedTools: OrchestratorResult['toolCalls'] = [];

  // Tool-use loop (max 10 iterations)
  for (let i = 0; i < 10; i++) {
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
        system: systemPrompt,
        tools,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${err}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }>;
      stop_reason: string;
    };

    // Check if we're done (no more tool use)
    if (data.stop_reason === 'end_turn' || !data.content.some((b) => b.type === 'tool_use')) {
      const textBlocks = data.content.filter((b) => b.type === 'text');
      const responseText = textBlocks.map((b) => b.text).join('\n');
      return { response: responseText, toolCalls: executedTools };
    }

    // Execute tool calls
    const assistantContent = data.content;
    messages.push({ role: 'assistant', content: assistantContent });

    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

    for (const block of assistantContent) {
      if (block.type === 'tool_use' && block.id && block.name && block.input) {
        const result = await executeTool(block.name, block.input, toolCtx);
        executedTools.push({ name: block.name, input: block.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    response: 'Reached maximum tool-use iterations.',
    toolCalls: executedTools,
  };
}

/**
 * Planner→Executor→Validator pipeline with SSE streaming.
 */
export interface PlanOrchestratorResult {
  mode: 'single' | 'multi';
  response: string;
  toolCalls: Array<{ name: string; input: Record<string, string>; result: string }>;
  plan?: { intent: string; stepCount: number };
  stepResults?: StepResult[];
  validation?: ValidationResult;
}

export async function orchestrateWithPlan(
  params: OrchestratorParams,
  onProgress?: SSEWriter,
): Promise<PlanOrchestratorResult> {
  const { prompt, userId, projectId, daClient, env } = params;

  // Classify: single or multi?
  const mode = await shouldPlan(prompt, env);
  onProgress?.({ event: 'mode', data: { mode } });

  if (mode === 'single') {
    // Use existing orchestrate() for simple requests
    const result = await orchestrate(params);
    return {
      mode: 'single',
      response: result.response,
      toolCalls: result.toolCalls,
    };
  }

  // Multi-step: Plan → Execute → Validate
  const context = await buildRAGContext(env.DB, userId, projectId, {
    vectorize: env.VECTORIZE,
    voyageApiKey: env.VOYAGE_API_KEY,
    voyageModel: env.VOYAGE_MODEL,
    query: prompt,
  });
  const tools = getToolDefinitions();

  // Plan
  onProgress?.({ event: 'plan_start', data: { prompt } });
  const plan = await createPlan(prompt, context, tools, env);
  onProgress?.({ event: 'plan_ready', data: { intent: plan.intent, stepCount: plan.steps.length, steps: plan.steps.map((s) => ({ id: s.id, description: s.description, toolName: s.toolName })) } });

  // Execute
  const toolCtx: ToolContext = {
    daClient,
    db: env.DB,
    vectorize: env.VECTORIZE,
    userId,
    projectId,
    voyageApiKey: env.VOYAGE_API_KEY,
    voyageModel: env.VOYAGE_MODEL,
    embedQueue: env.EMBED_QUEUE,
  };

  const stepResults = await executePlan(plan, toolCtx, env, onProgress);

  // Validate
  let validation: ValidationResult | undefined;
  if (plan.requiresValidation) {
    onProgress?.({ event: 'validation_start', data: {} });
    validation = await validateResults(plan, stepResults, env);
    onProgress?.({ event: 'validation_complete', data: { passed: validation.passed, issues: validation.issues, suggestions: validation.suggestions } });
  }

  // Build final response from step results
  const successResults = stepResults.filter((r) => r.status === 'success');
  const errorResults = stepResults.filter((r) => r.status === 'error');
  let response = `Completed: ${plan.intent}\n\n`;
  response += successResults.map((r) => `- ${r.result.slice(0, 200)}`).join('\n');
  if (errorResults.length) {
    response += `\n\nErrors:\n${errorResults.map((r) => `- Step ${r.stepId}: ${r.result}`).join('\n')}`;
  }
  if (validation?.suggestions?.length) {
    response += `\n\nSuggestions:\n${validation.suggestions.map((s) => `- ${s}`).join('\n')}`;
  }

  const toolCalls = stepResults
    .filter((r) => r.toolName)
    .map((r) => ({ name: r.toolName!, input: {} as Record<string, string>, result: r.result }));

  return {
    mode: 'multi',
    response,
    toolCalls,
    plan: { intent: plan.intent, stepCount: plan.steps.length },
    stepResults,
    validation,
  };
}
