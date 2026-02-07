/**
 * Shared EDS block library — default catalog + project-specific overrides from DB.
 */

export interface BlockInfo {
  name: string;
  category: string;
  description: string;
  structure: string;
  variants: string[];
  generativeConfig?: Record<string, unknown>;
  valueMetadata?: Record<string, unknown>;
  isCustom?: boolean;
}

const DEFAULT_BLOCKS: BlockInfo[] = [
  {
    name: 'hero',
    category: 'Structure',
    description: 'Large heading, text, and CTA buttons at the top of a page',
    structure: '<div class="hero"><div><div><picture><img src="" alt=""></picture></div><div><h1>Heading</h1><p>Description</p><p><a href="#">CTA</a></p></div></div></div>',
    variants: ['dark', 'centered', 'full-width'],
  },
  {
    name: 'cards',
    category: 'Content',
    description: 'Grid of items with images, headings, and descriptions',
    structure: '<div class="cards"><div><div><picture><img src="" alt=""></picture></div><div><h3>Card Title</h3><p>Card description.</p></div></div></div>',
    variants: ['horizontal', 'featured'],
  },
  {
    name: 'columns',
    category: 'Structure',
    description: 'Side-by-side content in 2-3 columns',
    structure: '<div class="columns"><div><div><h3>Column One</h3><p>Content.</p></div><div><h3>Column Two</h3><p>Content.</p></div></div></div>',
    variants: ['centered', 'wide'],
  },
  {
    name: 'accordion',
    category: 'Content',
    description: 'Expandable questions and answers',
    structure: '<div class="accordion"><div><div><h3>Question?</h3></div><div><p>Answer.</p></div></div></div>',
    variants: [],
  },
  {
    name: 'tabs',
    category: 'Content',
    description: 'Content organized in switchable tabs',
    structure: '<div class="tabs"><div><div>Tab One</div><div><p>Content for tab one.</p></div></div><div><div>Tab Two</div><div><p>Content for tab two.</p></div></div></div>',
    variants: [],
  },
  {
    name: 'carousel',
    category: 'Media',
    description: 'Rotating images or content panels',
    structure: '<div class="carousel"><div><div><picture><img src="" alt=""></picture></div></div><div><div><picture><img src="" alt=""></picture></div></div></div>',
    variants: ['auto-play', 'full-width'],
  },
  {
    name: 'quote',
    category: 'Content',
    description: 'Highlighted testimonial or pullquote',
    structure: '<div class="quote"><div><div><p>"Quote text here."</p><p>— Author Name</p></div></div></div>',
    variants: ['highlighted'],
  },
  {
    name: 'embed',
    category: 'Media',
    description: 'Embedded content (YouTube, social media, etc.)',
    structure: '<div class="embed"><div><div><a href="https://www.youtube.com/watch?v=VIDEO_ID">https://www.youtube.com/watch?v=VIDEO_ID</a></div></div></div>',
    variants: [],
  },
  {
    name: 'fragment',
    category: 'Structure',
    description: 'Reusable content section loaded from another path',
    structure: '<div class="fragment"><div><div><a href="/fragments/example">/fragments/example</a></div></div></div>',
    variants: [],
  },
  {
    name: 'section-metadata',
    category: 'Configuration',
    description: 'Section styling and configuration (style, layout, background)',
    structure: '<div class="section-metadata"><div><div>style</div><div>highlight</div></div></div>',
    variants: [],
  },
];

export async function getBlockLibrary(db: D1Database, projectId: string): Promise<BlockInfo[]> {
  const { results: dbBlocks } = await db.prepare(
    'SELECT * FROM block_library WHERE project_id = ? ORDER BY category, name',
  ).bind(projectId).all();

  const dbBlockNames = new Set((dbBlocks || []).map((b: Record<string, unknown>) => b.name));

  return [
    ...(dbBlocks || []).map((b: Record<string, unknown>) => ({
      name: b.name as string,
      category: (b.category as string) || 'Custom',
      description: '',
      structure: '',
      variants: [] as string[],
      generativeConfig: b.generative_config ? JSON.parse(b.generative_config as string) : {},
      valueMetadata: b.value_metadata ? JSON.parse(b.value_metadata as string) : {},
      isCustom: true,
    })),
    ...DEFAULT_BLOCKS.filter((b) => !dbBlockNames.has(b.name)),
  ];
}
