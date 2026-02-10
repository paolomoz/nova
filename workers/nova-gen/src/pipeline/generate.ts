import type { SelectedBlock } from '@nova/shared-types';
import type { ModelFactory } from '../lib/model-factory.js';
import type { SSECallback } from '../lib/sse.js';

/**
 * Return the canonical EDS row/cell pattern for a block type.
 * Helps the LLM produce conforming structure that survives the DA round-trip.
 */
function getBlockStructureHint(blockType: string): string {
  const hints: Record<string, string> = {
    hero: `Hero: 1 row with an image cell + a text cell.
<div class="hero">
  <div>
    <div><picture><img src="..." alt="..."></picture></div>
    <div><h1>Headline</h1><p>Subtext</p><p><a href="#">CTA</a></p></div>
  </div>
</div>`,
    columns: `Columns: ONE row with N cells (one per column). Do NOT use N rows.
<div class="columns">
  <div>
    <div><h3>Col 1</h3><p>Text</p></div>
    <div><h3>Col 2</h3><p>Text</p></div>
    <div><h3>Col 3</h3><p>Text</p></div>
  </div>
</div>`,
    cards: `Cards: N rows, each row is one card. Each card row has cells (e.g. image cell + text cell).
<div class="cards">
  <div>
    <div><picture><img src="..." alt="..."></picture></div>
    <div><h3>Card Title</h3><p>Card text</p></div>
  </div>
  <div>
    <div><picture><img src="..." alt="..."></picture></div>
    <div><h3>Card Title</h3><p>Card text</p></div>
  </div>
</div>`,
    accordion: `Accordion: N rows, each row has a question cell + answer cell.
<div class="accordion">
  <div>
    <div><h3>Question?</h3></div>
    <div><p>Answer text.</p></div>
  </div>
  <div>
    <div><h3>Question?</h3></div>
    <div><p>Answer text.</p></div>
  </div>
</div>`,
    tabs: `Tabs: N rows, each row has a label cell + content cell.
<div class="tabs">
  <div>
    <div>Tab Label</div>
    <div><p>Tab content.</p></div>
  </div>
  <div>
    <div>Tab Label</div>
    <div><p>Tab content.</p></div>
  </div>
</div>`,
  };

  if (hints[blockType]) return hints[blockType];

  // Generic fallback for unknown block types
  return `Generic block: use rows (direct child <div>s of the block) and cells (direct child <div>s of each row).
<div class="${blockType}">
  <div>
    <div>Cell content</div>
  </div>
</div>`;
}

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
      const structureHint = getBlockStructureHint(block.type);

      const result = await modelFactory.call(
        'content',
        [
          {
            role: 'system',
            content: `You are a content generator for AEM Edge Delivery Services (EDS). Generate HTML for a "${block.type}" block.

EDS block structure rules:
- A block is: <div class="block-name"><div>...rows...</div></div>
- Each row is a direct child <div> of the block. Each cell is a direct child <div> of a row.
- Do NOT add extra classes inside the block (no "hero-image", "cards-card-body", etc.) — AEM's decorate() adds those at runtime.
- Variants are space-separated classes on the outer div: <div class="cards horizontal">.
- Images: use <picture><img src="..." alt="..."></picture>.
- Section breaks between blocks: <hr>.
- Section metadata: <div class="section-metadata"><div><div>key</div><div>value</div></div></div> placed BEFORE the <hr>.
- Buttons/CTAs: plain <p><a href="#">Link text</a></p> — do NOT add "button" classes.

Structure for "${block.type}":
${structureHint}
${brandGuidance}
Respond with ONLY the HTML block. No markdown fences, no explanations.`,
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
