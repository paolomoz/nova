import type { DAAdminClient } from '@nova/da-client';
import { getToolDefinitions, executeTool } from './tools.js';
import { buildRAGContext } from './context.js';

interface OrchestratorEnv {
  ANTHROPIC_API_KEY: string;
  DB: D1Database;
}

interface OrchestratorParams {
  prompt: string;
  userId: string;
  projectId: string;
  daClient: DAAdminClient;
  env: OrchestratorEnv;
}

interface OrchestratorResult {
  response: string;
  toolCalls: Array<{ name: string; input: Record<string, string>; result: string }>;
}

/**
 * AI Orchestrator — Claude tool-use loop.
 * Sends the user prompt + tools to Claude, executes tool calls, continues until done.
 */
export async function orchestrate(params: OrchestratorParams): Promise<OrchestratorResult> {
  const { prompt, userId, projectId, daClient, env } = params;

  // Build context
  const context = await buildRAGContext(env.DB, userId, projectId);

  const systemPrompt = `You are Nova, an AI assistant for content management on AEM Edge Delivery Services.
You help users manage website content through the Document Authoring (DA) API.

Current context:
- ${context.projectInfo}
- Recent actions:
${context.recentActions}

You have tools to list, read, create, and delete pages. Use them to fulfill the user's request.
When creating pages, use clean HTML with EDS block markup.
Always confirm what you did after completing an action.`;

  const tools = getToolDefinitions();
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
        const result = await executeTool(
          block.name,
          block.input,
          daClient,
          env.DB,
          userId,
          projectId,
        );
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
