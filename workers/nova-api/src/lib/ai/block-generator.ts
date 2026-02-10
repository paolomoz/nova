/**
 * AI Block Generation Pipeline
 * Generates EDS block code (HTML structure, CSS, JS) using Claude.
 * Supports conversational iteration to refine blocks.
 */

import type { BlockInfo } from '../blocks.js';

export interface GeneratedBlock {
  name: string;
  description: string;
  category: string;
  structureHtml: string;
  css: string;
  js: string;
  variants: string[];
  previewHtml: string;
}

export interface BlockGenerationEnv {
  ANTHROPIC_API_KEY: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const BLOCK_SYSTEM_PROMPT = `You are an expert EDS (Edge Delivery Services) block developer. You generate production-quality block code.

EDS Block Conventions:
- Blocks are authored as HTML tables in documents, rendered as <div class="block-name"> wrappers.
- Block JS goes in /blocks/{name}/{name}.js — exports a default async function decorate(block) that transforms the DOM.
- Block CSS goes in /blocks/{name}/{name}.css — scoped styles using .block-name selectors.
- The block's initial DOM structure comes from the document: <div class="block-name"><div>rows</div></div>
- Each direct child <div> of the block is a row. Each direct child <div> of a row is a cell.
- The decorate function receives the block element after the DOM is built from the document.
- Use semantic HTML, modern CSS (custom properties, grid, flexbox), and vanilla JS (no frameworks).
- Ensure accessibility: proper ARIA roles, keyboard navigation, focus management.
- Performance: lazy load images, use CSS containment, minimize layout shifts.
- Mobile-first responsive design using CSS media queries.

When generating a block, respond with a JSON object containing:
{
  "name": "block-name",
  "description": "What this block does",
  "category": "Content|Structure|Media|Navigation|Configuration",
  "variants": ["variant1", "variant2"],
  "structureHtml": "<div class=\\"block-name\\"><div>...</div></div>",
  "css": ".block-name { ... }",
  "js": "export default async function decorate(block) { ... }"
}

Do NOT include a previewHtml field — it will be generated automatically from the parts. Keep the response as concise as possible.`;

export async function generateBlock(
  intent: string,
  existingBlocks: BlockInfo[],
  brandProfile: Record<string, unknown> | null,
  env: BlockGenerationEnv,
): Promise<GeneratedBlock> {
  const blockContext = existingBlocks.length > 0
    ? `\n\nExisting blocks in this project:\n${existingBlocks.map((b) => `- ${b.name} (${b.category}): ${b.description}`).join('\n')}`
    : '';

  const brandContext = brandProfile
    ? `\n\nBrand profile:\n${JSON.stringify(brandProfile, null, 2)}`
    : '';

  const userPrompt = `Generate an EDS block for this requirement:\n\n${intent}${blockContext}${brandContext}\n\nRespond with ONLY the JSON object, no markdown fences.`;

  return callClaude(userPrompt, [], env);
}

export async function iterateBlock(
  existingBlock: GeneratedBlock,
  feedback: string,
  conversationHistory: ConversationMessage[],
  env: BlockGenerationEnv,
): Promise<GeneratedBlock> {
  const currentState = `Current block state:\n\nName: ${existingBlock.name}\nCSS:\n${existingBlock.css}\n\nJS:\n${existingBlock.js}\n\nHTML Structure:\n${existingBlock.structureHtml}`;

  const userPrompt = `${currentState}\n\nUser feedback: ${feedback}\n\nUpdate the block based on this feedback. Respond with ONLY the complete updated JSON object.`;

  return callClaude(userPrompt, conversationHistory, env);
}

async function callClaude(
  userPrompt: string,
  history: ConversationMessage[],
  env: BlockGenerationEnv,
): Promise<GeneratedBlock> {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userPrompt },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: BLOCK_SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = data.content.find((b) => b.type === 'text')?.text || '';

  // Parse JSON from response (handle potential markdown fences)
  const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();

  let parsed: GeneratedBlock;
  try {
    parsed = JSON.parse(jsonStr) as GeneratedBlock;
  } catch {
    // JSON likely truncated due to token limit — try to salvage
    throw new Error(
      'AI response was truncated (JSON parse failed). The block may be too complex. Try a simpler description.',
    );
  }

  return {
    name: parsed.name || 'unnamed-block',
    description: parsed.description || '',
    category: parsed.category || 'Content',
    structureHtml: parsed.structureHtml || '',
    css: parsed.css || '',
    js: parsed.js || '',
    variants: parsed.variants || [],
    previewHtml: parsed.previewHtml || buildPreviewHtml(parsed),
  };
}

function buildPreviewHtml(block: GeneratedBlock): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${block.name} Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; background: #fff; color: #333; }
    img { max-width: 100%; height: auto; }
    ${block.css}
  </style>
</head>
<body>
  ${block.structureHtml}
  <script type="module">
    ${block.js}
    const block = document.querySelector('.${block.name}');
    if (block && typeof decorate === 'function') decorate(block);
  </script>
</body>
</html>`;
}
