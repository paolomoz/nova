/**
 * Block catalog — loaded from D1 per project.
 * Unlike vitamix-gensite which hardcoded blocks, Nova's catalog is configurable.
 */

export interface BlockCatalogEntry {
  name: string;
  category: string;
  whenToUse: string;
  dataRequirements: string[];
  guardrails: string[];
}

/** Default block catalog (used when project has no custom blocks) */
const DEFAULT_CATALOG: BlockCatalogEntry[] = [
  {
    name: 'hero',
    category: 'structure',
    whenToUse: 'Page header with strong visual and headline. Use for every page.',
    dataRequirements: ['headline', 'subheadline'],
    guardrails: ['Must have a clear CTA', 'Hero image should be high quality'],
  },
  {
    name: 'cards',
    category: 'content',
    whenToUse: 'Display multiple items in a grid layout. Good for products, features, or categories.',
    dataRequirements: ['items (3-6)', 'title per item', 'image per item'],
    guardrails: ['Keep card count between 3-6', 'Consistent image aspect ratios'],
  },
  {
    name: 'columns',
    category: 'layout',
    whenToUse: 'Side-by-side content layout. Good for features, comparisons, or content + image.',
    dataRequirements: ['2-4 column contents'],
    guardrails: ['Max 4 columns', 'Mobile should stack'],
  },
  {
    name: 'accordion',
    category: 'content',
    whenToUse: 'FAQ or expandable content sections. Use when there are many Q&A pairs.',
    dataRequirements: ['question-answer pairs'],
    guardrails: ['5-10 items ideal', 'Keep answers concise'],
  },
  {
    name: 'tabs',
    category: 'layout',
    whenToUse: 'Tabbed content for organizing related information.',
    dataRequirements: ['2-5 tab labels', 'content per tab'],
    guardrails: ['Max 5 tabs', 'Tab labels should be short'],
  },
  {
    name: 'table',
    category: 'content',
    whenToUse: 'Structured data display. Good for specs, comparisons, pricing.',
    dataRequirements: ['column headers', 'row data'],
    guardrails: ['Keep columns under 6', 'Use for genuinely tabular data'],
  },
  {
    name: 'testimonials',
    category: 'social-proof',
    whenToUse: 'Customer quotes and reviews. Builds trust and credibility.',
    dataRequirements: ['quote text', 'attribution'],
    guardrails: ['Real-sounding quotes', 'Include name and role'],
  },
  {
    name: 'cta',
    category: 'conversion',
    whenToUse: 'Call-to-action section. Use to drive specific user actions.',
    dataRequirements: ['headline', 'button text', 'button link'],
    guardrails: ['Single clear action', 'Compelling copy'],
  },
];

/**
 * Get block catalog for a project.
 * Falls back to default catalog if no custom blocks defined.
 */
export async function getBlockCatalog(
  projectId: string,
  db?: D1Database,
): Promise<BlockCatalogEntry[]> {
  if (!db) return DEFAULT_CATALOG;

  try {
    const { results } = await db
      .prepare(
        'SELECT name, category, generative_config FROM block_library WHERE project_id = ?',
      )
      .bind(projectId)
      .all();

    if (!results.length) return DEFAULT_CATALOG;

    return results.map((r) => {
      const config = JSON.parse((r.generative_config as string) || '{}');
      return {
        name: r.name as string,
        category: (r.category as string) || 'general',
        whenToUse: config.when_to_use || '',
        dataRequirements: config.data_requirements || [],
        guardrails: config.guardrails || [],
      };
    });
  } catch {
    return DEFAULT_CATALOG;
  }
}
