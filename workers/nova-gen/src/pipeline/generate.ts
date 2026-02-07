import type { SelectedBlock } from '@nova/shared-types';
import type { ModelFactory } from '../lib/model-factory.js';
import type { SSECallback } from '../lib/sse.js';

/**
 * Stage 3: Content Generation (fast model — parallel + SSE streaming)
 * Generates HTML content for each selected block.
 */
export async function generateBlocks(
  blocks: SelectedBlock[],
  query: string,
  ragContext: string,
  modelFactory: ModelFactory,
  env: { ANTHROPIC_API_KEY?: string; CEREBRAS_API_KEY?: string },
  write: SSECallback,
  brandVoice?: string,
): Promise<string[]> {
  const htmlBlocks: string[] = [];

  // Generate blocks in parallel batches of 3
  for (let i = 0; i < blocks.length; i += 3) {
    const batch = blocks.slice(i, i + 3);
    const promises = batch.map(async (block, batchIdx) => {
      const idx = i + batchIdx;
      write({ event: 'block-start', data: { blockType: block.type, index: idx } });

      const brandGuidance = brandVoice ? `\nBrand voice: ${brandVoice}` : '';

      const result = await modelFactory.call(
        'content',
        [
          {
            role: 'system',
            content: `You are a content generator. Generate HTML for an EDS (Edge Delivery Services) block.
The block type is "${block.type}". Generate clean, semantic HTML using div-based block structure.
Use this format:
<div class="${block.type}">
  <div><!-- row --><div><!-- cell content --></div></div>
</div>
${brandGuidance}
Respond with HTML only, no explanations.`,
          },
          {
            role: 'user',
            content: `Generate a "${block.type}" block for: "${query}"
Reason: ${block.reason}
Context: ${ragContext}`,
          },
        ],
        env,
      );

      write({
        event: 'block-content',
        data: { html: result.content, sectionStyle: block.sectionStyle, index: idx },
      });

      return result.content;
    });

    const results = await Promise.all(promises);
    htmlBlocks.push(...results);
  }

  return htmlBlocks;
}
