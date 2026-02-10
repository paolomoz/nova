import type { SelectedBlock, BlockContent } from '@nova/shared-types';
import type { ModelFactory } from '../lib/model-factory.js';
import type { SSECallback } from '../lib/sse.js';
import { buildBlockHTML } from './block-builders.js';

/**
 * Return a JSON schema description for each block type.
 * The LLM outputs JSON matching this schema; builders produce the HTML deterministically.
 */
function getBlockContentSchema(blockType: string): string {
  const schemas: Record<string, string> = {
    hero: `{
  "headline": "string — compelling H1 headline",
  "subheadline": "string (optional) — supporting paragraph",
  "ctaText": "string (optional) — call-to-action button text",
  "ctaUrl": "string (optional) — CTA link URL",
  "imageAlt": "string (optional) — alt text for the hero image"
}`,
    cards: `{
  "cards": [
    {
      "title": "string — card title",
      "description": "string — card body text",
      "imageAlt": "string (optional) — alt text for card image",
      "linkText": "string (optional) — link text",
      "linkUrl": "string (optional) — link URL"
    }
  ]
}
Generate 3-6 cards.`,
    columns: `{
  "columns": [
    {
      "headline": "string (optional) — column heading",
      "text": "string — column body text"
    }
  ]
}
Generate 2-4 columns.`,
    accordion: `{
  "items": [
    {
      "question": "string — the question",
      "answer": "string — the answer"
    }
  ]
}
Generate 3-6 FAQ items.`,
    tabs: `{
  "tabs": [
    {
      "label": "string — tab label",
      "content": "string — tab content text"
    }
  ]
}
Generate 2-5 tabs.`,
    table: `{
  "headers": ["string — column header", ...],
  "rows": [["string — cell value", ...], ...]
}
Generate a table with 2-5 columns and 3-6 data rows.`,
    testimonials: `{
  "testimonials": [
    {
      "quote": "string — the testimonial quote",
      "author": "string — person's name",
      "role": "string (optional) — job title or role"
    }
  ]
}
Generate 2-4 testimonials.`,
    cta: `{
  "headline": "string — CTA headline",
  "text": "string (optional) — supporting text",
  "buttonText": "string — button label",
  "buttonUrl": "string — button link URL"
}`,
  };

  if (schemas[blockType]) return schemas[blockType];

  return `{
  "content": "string — the block content"
}
Return a simple JSON object with relevant content fields for this "${blockType}" block.`;
}

export interface GeneratedBlock {
  blockType: string;
  html: string;
  sectionStyle?: string;
}

/**
 * Stage 3: Content Generation (fast model — parallel + SSE streaming)
 * Generates JSON content for each block, then deterministically builds EDS HTML.
 */
export async function generateBlocks(
  blocks: SelectedBlock[],
  query: string,
  ragContext: string,
  modelFactory: ModelFactory,
  env: { ANTHROPIC_API_KEY?: string; CEREBRAS_API_KEY?: string },
  write: SSECallback,
  brandVoice?: string,
): Promise<GeneratedBlock[]> {
  const generatedBlocks: GeneratedBlock[] = [];

  // Generate blocks in parallel batches of 3
  for (let i = 0; i < blocks.length; i += 3) {
    const batch = blocks.slice(i, i + 3);
    const promises = batch.map(async (block, batchIdx) => {
      const idx = i + batchIdx;
      write({ event: 'block-start', data: { blockType: block.type, index: idx } });

      const brandGuidance = brandVoice ? `\nBrand voice: ${brandVoice}` : '';
      const contentSchema = getBlockContentSchema(block.type);

      const result = await modelFactory.call(
        'content',
        [
          {
            role: 'system',
            content: `You are a content generator. Generate JSON content for a "${block.type}" block.

Return ONLY valid JSON matching this schema — no markdown fences, no explanations, no extra text:

${contentSchema}
${brandGuidance}`,
          },
          {
            role: 'user',
            content: `Generate content for a "${block.type}" block.
Topic: "${query}"
Reason this block was chosen: ${block.reason}
Context: ${ragContext}`,
          },
        ],
        env,
      );

      // Parse JSON from LLM response
      let content: BlockContent;
      try {
        const raw = result.content.trim();
        // Strip markdown code fences if the LLM added them
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        content = JSON.parse(cleaned);
      } catch {
        // Fallback: if JSON parsing fails, wrap raw text as a generic block
        content = { headline: query, text: result.content } as unknown as BlockContent;
      }

      // Build deterministic EDS HTML from the parsed content
      const html = buildBlockHTML(block.type, content);

      write({
        event: 'block-content',
        data: { html, sectionStyle: block.sectionStyle, index: idx },
      });

      return { blockType: block.type, html, sectionStyle: block.sectionStyle };
    });

    const results = await Promise.all(promises);
    generatedBlocks.push(...results);
  }

  return generatedBlocks;
}
