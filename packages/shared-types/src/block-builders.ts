import type {
  HeroContent,
  CardsContent,
  ColumnsContent,
  AccordionContent,
  TabsContent,
  TableContent,
  TestimonialsContent,
  CTAContent,
  BlockContent,
} from './generative.js';

export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildHeroHTML(content: HeroContent): string {
  const imgSrc = content.imageUrl || '/media_placeholder.png';
  const imgAlt = escapeHTML(content.imageAlt || content.headline);
  return `<div class="hero">
  <div>
    <div>
      <picture><img src="${escapeHTML(imgSrc)}" alt="${imgAlt}" loading="lazy"></picture>
    </div>
    <div>
      <h1>${escapeHTML(content.headline)}</h1>
      ${content.subheadline ? `<p>${escapeHTML(content.subheadline)}</p>` : ''}
      ${content.ctaText ? `<p><a href="${escapeHTML(content.ctaUrl || '#')}">${escapeHTML(content.ctaText)}</a></p>` : ''}
    </div>
  </div>
</div>`;
}

export function buildCardsHTML(content: CardsContent): string {
  const rows = content.cards.map((card) => {
    const imgSrc = card.imageUrl || '/media_placeholder.png';
    const imgAlt = escapeHTML(card.imageAlt || card.title);
    return `  <div>
    <div>
      <picture><img src="${escapeHTML(imgSrc)}" alt="${imgAlt}" loading="lazy"></picture>
    </div>
    <div>
      <p><strong>${escapeHTML(card.title)}</strong></p>
      <p>${escapeHTML(card.description)}</p>
      ${card.linkText ? `<p><a href="${escapeHTML(card.linkUrl || '#')}">${escapeHTML(card.linkText)}</a></p>` : ''}
    </div>
  </div>`;
  }).join('\n');

  return `<div class="cards">
${rows}
</div>`;
}

export function buildColumnsHTML(content: ColumnsContent): string {
  const cells = content.columns.map((col) => {
    let inner = '';
    if (col.headline) inner += `<h3>${escapeHTML(col.headline)}</h3>`;
    inner += `<p>${escapeHTML(col.text)}</p>`;
    return `    <div>${inner}</div>`;
  }).join('\n');

  return `<div class="columns">
  <div>
${cells}
  </div>
</div>`;
}

export function buildAccordionHTML(content: AccordionContent): string {
  const rows = content.items.map((item) =>
    `  <div>
    <div>${escapeHTML(item.question)}</div>
    <div>${escapeHTML(item.answer)}</div>
  </div>`
  ).join('\n');

  return `<div class="accordion">
${rows}
</div>`;
}

export function buildTabsHTML(content: TabsContent): string {
  const rows = content.tabs.map((tab) =>
    `  <div>
    <div>${escapeHTML(tab.label)}</div>
    <div><p>${escapeHTML(tab.content)}</p></div>
  </div>`
  ).join('\n');

  return `<div class="tabs">
${rows}
</div>`;
}

export function buildTableHTML(content: TableContent): string {
  const headerCells = content.headers.map((h) => `    <div>${escapeHTML(h)}</div>`).join('\n');
  const headerRow = `  <div>\n${headerCells}\n  </div>`;

  const dataRows = content.rows.map((row) => {
    const cells = row.map((cell) => `    <div>${escapeHTML(cell)}</div>`).join('\n');
    return `  <div>\n${cells}\n  </div>`;
  }).join('\n');

  return `<div class="table">
${headerRow}
${dataRows}
</div>`;
}

export function buildTestimonialsHTML(content: TestimonialsContent): string {
  const rows = content.testimonials.map((t) => {
    const attribution = t.role ? `${escapeHTML(t.author)}, ${escapeHTML(t.role)}` : escapeHTML(t.author);
    return `  <div>
    <div><p>${escapeHTML(t.quote)}</p></div>
    <div><p>${attribution}</p></div>
  </div>`;
  }).join('\n');

  return `<div class="testimonials">
${rows}
</div>`;
}

export function buildCTAHTML(content: CTAContent): string {
  return `<div class="cta">
  <div>
    <div>
      <h2>${escapeHTML(content.headline)}</h2>
      ${content.text ? `<p>${escapeHTML(content.text)}</p>` : ''}
      <p><a href="${escapeHTML(content.buttonUrl)}">${escapeHTML(content.buttonText)}</a></p>
    </div>
  </div>
</div>`;
}

export function buildBlockHTML(blockType: string, content: BlockContent): string {
  switch (blockType) {
    case 'hero':
      return buildHeroHTML(content as HeroContent);
    case 'cards':
      return buildCardsHTML(content as CardsContent);
    case 'columns':
      return buildColumnsHTML(content as ColumnsContent);
    case 'accordion':
      return buildAccordionHTML(content as AccordionContent);
    case 'tabs':
      return buildTabsHTML(content as TabsContent);
    case 'table':
      return buildTableHTML(content as TableContent);
    case 'testimonials':
      return buildTestimonialsHTML(content as TestimonialsContent);
    case 'cta':
      return buildCTAHTML(content as CTAContent);
    default:
      return `<div class="${escapeHTML(blockType)}">
  <div>
    <div>${JSON.stringify(content)}</div>
  </div>
</div>`;
  }
}

export interface EDSBlock {
  html: string;
  sectionStyle?: string;
}

export function buildEDSHTML(blocks: EDSBlock[], title: string, query: string): string {
  const sections = blocks.map((block) => {
    let sectionMetadata = '';
    if (block.sectionStyle && block.sectionStyle !== 'default') {
      sectionMetadata = `\n<div class="section-metadata">
  <div>
    <div>style</div>
    <div>${escapeHTML(block.sectionStyle)}</div>
  </div>
</div>`;
    }

    return `<div>
${block.html}${sectionMetadata}
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHTML(title)}</title>
  <meta name="description" content="${escapeHTML(query)}">
  <meta name="template" content="generative">
</head>
<body>
  <header></header>
  <main>
${sections}
  </main>
  <footer></footer>
</body>
</html>`;
}

/**
 * Parse a JSON page description and build full EDS HTML.
 * Expected format: { title?, blocks: [{ type, content, sectionStyle? }] }
 * Returns null if the input is not valid JSON blocks.
 */
export function tryBuildFromJSON(input: string): string | null {
  let parsed: { title?: string; blocks?: Array<{ type: string; content: BlockContent; sectionStyle?: string }> };
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }

  if (!parsed.blocks || !Array.isArray(parsed.blocks)) return null;

  const edsBlocks: EDSBlock[] = parsed.blocks.map((b) => ({
    html: buildBlockHTML(b.type, b.content),
    sectionStyle: b.sectionStyle,
  }));

  const title = parsed.title || 'Generated Page';
  return buildEDSHTML(edsBlocks, title, title);
}
