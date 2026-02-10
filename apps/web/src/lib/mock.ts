/**
 * Mock API layer for UI preview without a backend.
 * Activated by VITE_MOCK=true in .env
 */
import { api } from './api';
import { useAuth } from './auth';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Mock Data ────────────────────────────────────────────────

const MOCK_USER = {
  id: 'u-1',
  email: 'demo@adobe.com',
  name: 'Demo User',
  avatarUrl: '',
};

const MOCK_ORG = { id: 'org-1', slug: 'adobe-demo', name: 'Adobe Demo' };

const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'WKND Adventures', slug: 'wknd', da_org: 'wknd', da_repo: 'wknd-adventures' },
  { id: 'proj-2', name: 'Crea Blog', slug: 'crea', da_org: 'crea', da_repo: 'crea-blog' },
];

const MOCK_PAGES: Record<string, Array<{ name: string; path: string; ext?: string; lastModified?: string }>> = {
  '/': [
    { name: 'en', path: '/en', lastModified: '2025-12-01T10:00:00Z' },
    { name: 'fr', path: '/fr', lastModified: '2025-11-15T08:00:00Z' },
    { name: 'nav', path: '/nav.html', ext: 'html', lastModified: '2025-11-20T14:30:00Z' },
    { name: 'footer', path: '/footer.html', ext: 'html', lastModified: '2025-11-20T14:30:00Z' },
  ],
  '/en': [
    { name: 'index', path: '/en/index.html', ext: 'html', lastModified: '2025-12-10T09:00:00Z' },
    { name: 'about', path: '/en/about.html', ext: 'html', lastModified: '2025-12-08T11:00:00Z' },
    { name: 'blog', path: '/en/blog', lastModified: '2025-12-05T16:00:00Z' },
    { name: 'products', path: '/en/products', lastModified: '2025-12-01T10:00:00Z' },
    { name: 'contact', path: '/en/contact.html', ext: 'html', lastModified: '2025-11-28T13:00:00Z' },
  ],
  '/en/blog': [
    { name: 'adventure-awaits', path: '/en/blog/adventure-awaits.html', ext: 'html', lastModified: '2025-12-12T10:00:00Z' },
    { name: 'best-trails-2025', path: '/en/blog/best-trails-2025.html', ext: 'html', lastModified: '2025-12-10T08:00:00Z' },
    { name: 'gear-guide', path: '/en/blog/gear-guide.html', ext: 'html', lastModified: '2025-12-08T14:00:00Z' },
    { name: 'winter-camping', path: '/en/blog/winter-camping.html', ext: 'html', lastModified: '2025-12-06T09:00:00Z' },
  ],
  '/en/products': [
    { name: 'backpacks', path: '/en/products/backpacks.html', ext: 'html', lastModified: '2025-12-01T10:00:00Z' },
    { name: 'boots', path: '/en/products/boots.html', ext: 'html', lastModified: '2025-11-28T10:00:00Z' },
    { name: 'jackets', path: '/en/products/jackets.html', ext: 'html', lastModified: '2025-11-25T10:00:00Z' },
  ],
  '/fr': [
    { name: 'index', path: '/fr/index.html', ext: 'html', lastModified: '2025-12-01T10:00:00Z' },
  ],
};

const MOCK_TEMPLATES = [
  { id: 't-1', name: 'Blank Page', description: 'Empty page with no blocks', html: '<body><header></header><main><div></div></main><footer></footer></body>' },
  { id: 't-2', name: 'Blog Post', description: 'Article with hero and text', html: '<body><header></header><main><div><h1>Title</h1><p>Content here...</p></div></main><footer></footer></body>' },
  { id: 't-3', name: 'Landing Page', description: 'Marketing page with hero, features, CTA', html: '<body><header></header><main><div><h1>Hero</h1></div><div class="columns"><div>Feature 1</div><div>Feature 2</div></div></main><footer></footer></body>' },
];

const MOCK_BLOCKS = [
  { name: 'Hero', category: 'Layout', description: 'Full-width hero with image and text overlay', structure: '<div class="hero"><div><div><picture><img></picture></div><div><h1></h1><p></p></div></div></div>', variants: ['centered', 'left-aligned', 'video'], isCustom: false },
  { name: 'Cards', category: 'Content', description: 'Grid of content cards with image, title, description', structure: '<div class="cards"><div><div><picture><img></picture></div><div><h3></h3><p></p></div></div></div>', variants: ['2-up', '3-up', '4-up', 'horizontal'], isCustom: false },
  { name: 'Columns', category: 'Layout', description: 'Multi-column layout', structure: '<div class="columns"><div><div>Col 1</div><div>Col 2</div></div></div>', variants: ['2-col', '3-col', 'sidebar'], isCustom: false },
  { name: 'Tabs', category: 'Navigation', description: 'Tabbed content sections', structure: '<div class="tabs"><div><div>Tab 1</div><div>Content 1</div></div></div>', variants: ['horizontal', 'vertical'], isCustom: false },
  { name: 'Accordion', category: 'Content', description: 'Expandable FAQ-style sections', structure: '<div class="accordion"><div><div>Question</div><div>Answer</div></div></div>', variants: ['single-open', 'multi-open'], isCustom: false },
  { name: 'Carousel', category: 'Media', description: 'Image or content slideshow', structure: '<div class="carousel"><div><div><picture><img></picture></div></div></div>', variants: ['auto-play', 'manual', 'fade'], isCustom: true },
];

const MOCK_SUGGESTIONS = [
  { text: 'Analyze content performance for /en/blog', prompt: 'Analyze the content performance and value scores for all pages under /en/blog' },
  { text: 'Generate a new product landing page', prompt: 'Create a new landing page at /en/products/new-arrivals with a hero, featured products grid, and CTA section' },
  { text: 'Check brand voice compliance', prompt: 'Run a brand voice audit across all published pages and flag any that fall below 80% compliance' },
  { text: 'Optimize SEO for the homepage', prompt: 'Analyze SEO for /en/index and suggest improvements for title, meta description, and structured data' },
];

const MOCK_ACTIONS = [
  { id: 'a-1', action_type: 'create_page', description: 'Created page /en/blog/adventure-awaits', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'a-2', action_type: 'ai_generate', description: 'Generated hero content for /en/index', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'a-3', action_type: 'publish', description: 'Published /en/blog/best-trails-2025', created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 'a-4', action_type: 'edit_block', description: 'Updated Cards block on /en/products', created_at: new Date(Date.now() - 14400000).toISOString() },
];

const MOCK_ASSETS = [
  { id: 'asset-1', path: '/media/hero-mountains.jpg', name: 'hero-mountains.jpg', mimeType: 'image/jpeg', size: 524288, width: 1920, height: 1080, altText: 'Mountain landscape at sunset', tags: ['hero', 'landscape', 'mountains'], colorPalette: ['#2D3748', '#ED8936', '#ECC94B'], updatedAt: '2025-12-10T09:00:00Z' },
  { id: 'asset-2', path: '/media/team-photo.jpg', name: 'team-photo.jpg', mimeType: 'image/jpeg', size: 312000, width: 1200, height: 800, altText: 'WKND team at basecamp', tags: ['team', 'people', 'outdoor'], colorPalette: ['#4A5568', '#48BB78', '#38B2AC'], updatedAt: '2025-12-08T14:00:00Z' },
  { id: 'asset-3', path: '/media/backpack-hero.png', name: 'backpack-hero.png', mimeType: 'image/png', size: 890000, width: 800, height: 800, altText: 'Premium hiking backpack', tags: ['product', 'backpack', 'gear'], colorPalette: ['#1A202C', '#E53E3E', '#DD6B20'], updatedAt: '2025-12-05T16:00:00Z' },
  { id: 'asset-4', path: '/media/logo.svg', name: 'logo.svg', mimeType: 'image/svg+xml', size: 4200, width: 200, height: 50, altText: 'WKND logo', tags: ['logo', 'brand'], colorPalette: [], updatedAt: '2025-11-01T10:00:00Z' },
];

const MOCK_BRAND_PROFILES: Array<{
  id: string; name: string;
  voice: { tone: string; personality: string; dos: string[]; donts: string[] };
  visual: { colors: Record<string, string>; typography: Record<string, string> };
  contentRules: Record<string, unknown>; designTokens: Record<string, string>;
  updatedAt: string;
}> = [
  {
    id: 'bp-1',
    name: 'default',
    voice: {
      tone: 'adventurous, inspiring, warm, authentic',
      personality: 'An experienced outdoor guide who is passionate about nature and helping others discover life-changing adventures. Speaks from first-hand experience with genuine enthusiasm, like a trusted friend who knows every trail.',
      dos: [
        'Use active voice and action-oriented language',
        'Inspire readers to get outdoors and explore',
        'Share real stories and first-hand experiences',
        'Address the reader directly using "you" and "your"',
        'Include specific, practical details (trail distances, gear specs)',
        'Celebrate all skill levels — beginner to expert',
        'Use sensory language to paint vivid pictures of the outdoors',
        'End with a clear call to action',
      ],
      donts: [
        'Use overly technical jargon without explanation',
        'Be condescending about experience levels',
        'Overuse superlatives like "best ever" or "most amazing"',
        'Make unsubstantiated safety claims',
        'Use passive voice when active is clearer',
        'Write walls of text without scannable headings',
        'Ignore accessibility in language or imagery',
        'Use fear-based marketing tactics',
      ],
    },
    visual: {
      colors: {
        primary: '#E53E3E',
        secondary: '#2D3748',
        accent: '#ED8936',
        success: '#38A169',
        background: '#F7FAFC',
        'text-primary': '#1A202C',
      },
      typography: {
        heading: 'Asar, serif',
        body: 'Source Sans Pro, sans-serif',
        mono: 'Source Code Pro, monospace',
        'scale-ratio': '1.25 (Major Third)',
      },
    },
    contentRules: {
      maxHeadingLength: 70,
      requiredSections: ['intro', 'body', 'cta'],
      readabilityTarget: 'Grade 8 (Flesch-Kincaid)',
      seoMinWordCount: 300,
      terminology: {
        'hike': 'preferred over "walk" for trail content',
        'adventure': 'core brand term — use liberally',
        'gear': 'preferred over "equipment" or "products"',
        'trail-tested': 'use for product endorsements',
      },
    },
    designTokens: {
      'spacing-base': '4px',
      'radius-sm': '4px',
      'radius-md': '8px',
      'radius-lg': '16px',
      'shadow-card': '0 1px 3px rgba(0,0,0,0.12)',
      'max-content-width': '1200px',
    },
    updatedAt: new Date().toISOString(),
  },
];

const MOCK_SEO_PAGES = [
  { id: 'seo-1', path: '/en/index', title: 'WKND Adventures - Outdoor Gear & Travel', description: 'Discover premium outdoor gear and adventure travel guides.', keywords: ['outdoor', 'adventure', 'hiking', 'gear'], canonicalUrl: null, ogImage: '/media/hero-mountains.jpg', structuredData: {}, robots: 'index, follow', internalLinks: [], seoScore: 87, llmCitabilityScore: 72, updatedAt: '2025-12-10T09:00:00Z' },
  { id: 'seo-2', path: '/en/blog/adventure-awaits', title: 'Adventure Awaits: Top Trails for 2025', description: 'Explore the best hiking trails for the upcoming season.', keywords: ['trails', 'hiking', '2025'], canonicalUrl: null, ogImage: null, structuredData: {}, robots: 'index, follow', internalLinks: [], seoScore: 92, llmCitabilityScore: 85 },
  { id: 'seo-3', path: '/en/products/backpacks', title: 'Hiking Backpacks - WKND', description: 'Shop our collection of premium hiking backpacks.', keywords: ['backpack', 'hiking', 'gear'], canonicalUrl: null, ogImage: null, structuredData: {}, robots: 'index, follow', internalLinks: [], seoScore: 65, llmCitabilityScore: 45 },
];

const MOCK_FRAGMENT_MODELS = [
  { id: 'fm-1', name: 'Blog Article', description: 'Structured blog post', schema: { title: { type: 'string' }, author: { type: 'string' }, category: { type: 'string' }, body: { type: 'richtext' }, publishDate: { type: 'date' } }, createdAt: '2025-11-01T10:00:00Z' },
  { id: 'fm-2', name: 'Product', description: 'Product listing', schema: { name: { type: 'string' }, price: { type: 'number' }, description: { type: 'richtext' }, image: { type: 'asset' }, category: { type: 'string' } }, createdAt: '2025-11-05T10:00:00Z' },
];

const MOCK_FRAGMENTS = [
  { id: 'cf-1', modelId: 'fm-1', modelName: 'Blog Article', title: 'Adventure Awaits', slug: 'adventure-awaits', data: { title: 'Adventure Awaits', author: 'Jane Smith', category: 'Travel' }, status: 'published', tags: ['featured'], createdAt: '2025-12-10T09:00:00Z', updatedAt: '2025-12-12T10:00:00Z' },
  { id: 'cf-2', modelId: 'fm-2', modelName: 'Product', title: 'Trail Pro 65L', slug: 'trail-pro-65l', data: { name: 'Trail Pro 65L', price: 249.99, category: 'Backpacks' }, status: 'draft', tags: ['gear'], createdAt: '2025-12-08T14:00:00Z', updatedAt: '2025-12-08T14:00:00Z' },
];

const MOCK_WORKFLOWS = [
  { id: 'wf-1', name: 'Blog Review: Adventure Awaits', type: 'review', status: 'in_progress', path: '/en/blog/adventure-awaits', description: 'Content review before publish', assignedTo: 'editor@adobe.com', createdBy: 'u-1', dueDate: '2025-12-20T00:00:00Z', completedAt: null, createdAt: '2025-12-10T09:00:00Z' },
  { id: 'wf-2', name: 'Homepage Redesign Approval', type: 'approval', status: 'pending', path: '/en/index', description: 'Approve new homepage design', assignedTo: null, createdBy: 'u-1', dueDate: '2025-12-25T00:00:00Z', completedAt: null, createdAt: '2025-12-12T14:00:00Z' },
];

const MOCK_LAUNCHES = [
  { id: 'l-1', name: 'Holiday Campaign', description: 'Holiday season content launch', status: 'scheduled', sourceBranch: 'launch-holiday-2025', scheduledAt: '2025-12-20T08:00:00Z', publishedAt: null, paths: ['/en/products', '/en/blog'], createdBy: 'u-1', createdAt: '2025-12-01T10:00:00Z' },
];

const MOCK_NOTIFICATIONS = [
  { id: 'n-1', type: 'workflow', title: 'Review requested', body: 'Jane Smith requested review of /en/blog/adventure-awaits', link: '/enterprise', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'n-2', type: 'publish', title: 'Page published', body: '/en/blog/best-trails-2025 is now live', link: '/sites', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_TRANSLATIONS = [
  { id: 'tr-1', sourcePath: '/en/index', sourceLocale: 'en', targetLocale: 'fr', targetPath: '/fr/index', status: 'completed', provider: 'claude', createdAt: '2025-12-01T10:00:00Z' },
];

// ── Mock Implementation ─────────────────────────────────────

function mock<T>(data: T, ms = 200): Promise<T> {
  return delay(ms).then(() => data);
}

export function enableMockMode() {
  console.log('%c[Nova] Mock mode enabled', 'color: #3B63FB; font-weight: bold;');

  // Patch auth store — auto-login
  const authStore = useAuth.getState();
  useAuth.setState({
    user: MOCK_USER,
    org: MOCK_ORG,
    orgs: [MOCK_ORG, { id: 'org-2', slug: 'personal', name: 'Personal' }],
    loading: false,
    error: null,
    onboarded: true,
  });

  // Override checkAuth to not hit API
  const noopCheckAuth = async () => {
    useAuth.setState({ user: MOCK_USER, org: MOCK_ORG, loading: false });
  };
  useAuth.setState({ checkAuth: noopCheckAuth, loadOrgs: async () => {} });

  // ── Patch api object ──

  // Auth
  Object.assign(api, {
    getMe: () => mock({ user: MOCK_USER, org: MOCK_ORG }),
    loginWithGitHub: () => mock({}),
    loginWithIMS: () => mock({}),
    switchOrg: () => mock({ ok: true }),
    getOrgs: () => mock({ orgs: [MOCK_ORG] }),
    updatePreferences: () => mock({ ok: true }),
    logout: () => mock({ ok: true }),
  });

  // Projects
  Object.assign(api, {
    getProjects: () => mock({ projects: MOCK_PROJECTS }),
    createProject: () => mock({ id: 'proj-new' }),
  });

  // Content
  Object.assign(api, {
    listPages: (_pid: string, path: string = '/') => mock({ items: MOCK_PAGES[path] || [] }),
    getPageSource: (_pid: string, path: string) => {
      const pages: Record<string, string> = {
        default: `<h1>Welcome to WKND</h1><p>Your adventure starts here. Discover trails, gear, and stories from fellow adventurers.</p><hr><h2>Adventure Awaits</h2><p>Explore the world with WKND. From mountain peaks to hidden valleys, we guide you through the best outdoor experiences.</p><p><a href="/en/products">Shop Gear</a></p><hr><h3>Trail Guide</h3><p>Expert-curated hiking routes for every skill level.</p><h3>Gear Reviews</h3><p>Honest reviews from the field — tested by real adventurers.</p><h3>Community</h3><p>Connect with fellow adventurers and share your stories.</p>`,
        '/en/blog/adventure-awaits.html': `<h1>Adventure Awaits: Top Trails for 2025</h1><p><em>By Jane Smith · December 12, 2025</em></p><p>The new year is just around the corner, and it's time to plan your next great outdoor adventure. We've curated the top trails you absolutely must explore in 2025.</p><h2>1. Pacific Crest Trail — Section J</h2><p>This stunning 76-mile section through the North Cascades offers breathtaking alpine meadows and glacier views. Best hiked from July through September.</p><h2>2. Dolomites Alta Via 1</h2><p>Italy's most famous long-distance trail takes you through dramatic limestone peaks and cozy mountain refugios over 7-10 days.</p><h2>3. Torres del Paine W Trek</h2><p>Patagonia's crown jewel delivers turquoise lakes, massive glaciers, and the iconic granite towers. Book refugios early — this one fills up fast.</p><h3>Gear Essentials</h3><p>Don't hit the trail without these essentials:</p><ul><li>Lightweight 3-season tent (under 3 lbs)</li><li>Merino wool base layers</li><li>Trail runners with aggressive tread</li><li>Water filter or purification tablets</li></ul><p><strong>Ready to start planning?</strong> Check out our <a href="/en/products">gear shop</a> for trail-tested equipment.</p>`,
        '/en/products/backpacks.html': `<h1>Hiking Backpacks</h1><p>Find the perfect pack for your next adventure. Our collection features trail-tested backpacks for day hikes to thru-hikes.</p><h2>Trail Pro 65L</h2><p><strong>$249.99</strong> — Our flagship backpack for multi-day adventures. Features adjustable torso length, rain cover, and 8 external pockets.</p><h2>Day Pack 28L</h2><p><strong>$89.99</strong> — Lightweight and versatile for day hikes. Includes hydration sleeve and trekking pole attachments.</p><h2>Summit Ultra 45L</h2><p><strong>$179.99</strong> — The perfect balance of capacity and weight for weekend warriors. Dyneema construction keeps it under 2 lbs.</p>`,
      };
      return mock({ content: pages[path] || pages.default, contentType: 'text/html' });
    },
    createPage: () => mock({ ok: true }),
    deletePage: () => mock({ ok: true }),
    copyPage: () => mock({ ok: true }),
    movePage: () => mock({ ok: true }),
  });

  // Properties
  Object.assign(api, {
    getProperties: () => mock({ path: '/en/index', deliveryMode: 'hybrid', annotations: [{ id: 'ann-1', audience: 'outdoor-enthusiasts', situation: 'organic-search', outcome: 'product-discovery', composite_score: 0.78 }] }),
    updateProperties: () => mock({ ok: true }),
    deleteAnnotation: () => mock({ ok: true }),
  });

  // Templates, Suggestions, Search
  Object.assign(api, {
    getTemplates: () => mock({ templates: MOCK_TEMPLATES }),
    getSuggestions: () => mock({ suggestions: MOCK_SUGGESTIONS }),
    search: (_pid: string, query: string) => mock({
      results: [
        { path: '/en/blog/adventure-awaits', title: 'Adventure Awaits', snippet: `...matching "${query}" in content...`, score: 0.92, source: 'semantic' as const },
        { path: '/en/index', title: 'WKND Home', snippet: `...found "${query}" reference...`, score: 0.78, source: 'keyword' as const },
      ],
      query,
    }),
  });

  // AI
  Object.assign(api, {
    executeAI: (_pid: string, prompt: string) => mock({
      response: `I've analyzed your request: "${prompt}"\n\nHere's what I found:\n- 12 pages in the /en directory\n- 4 blog posts, 3 product pages\n- Average SEO score: 81/100\n\nWould you like me to take any action on these pages?`,
      toolCalls: [{ name: 'list_pages', input: { path: '/en' }, result: '12 items found' }],
    }, 500),
    getActionHistory: () => mock({ actions: MOCK_ACTIONS }),
    streamAI: (_pid: string, _prompt: string, onEvent: (e: { event: string; data: Record<string, unknown> }) => void) => {
      const controller = new AbortController();
      (async () => {
        await delay(300);
        onEvent({ event: 'mode', data: { mode: 'multi' } });
        await delay(200);
        onEvent({ event: 'plan_start', data: {} });
        await delay(400);
        onEvent({ event: 'plan_ready', data: { intent: 'Analyzing content structure', stepCount: 3, steps: [] } });
        await delay(600);
        onEvent({ event: 'step_start', data: { stepId: '1', description: 'Listing pages under /en' } });
        await delay(800);
        onEvent({ event: 'step_complete', data: { stepId: '1', status: 'success', description: 'Listed 12 pages' } });
        await delay(300);
        onEvent({ event: 'step_start', data: { stepId: '2', description: 'Reading page content' } });
        await delay(700);
        onEvent({ event: 'step_complete', data: { stepId: '2', status: 'success', description: 'Analyzed content structure' } });
        await delay(300);
        onEvent({ event: 'step_start', data: { stepId: '3', description: 'Generating summary' } });
        await delay(500);
        onEvent({ event: 'step_complete', data: { stepId: '3', status: 'success', description: 'Summary generated' } });
        await delay(200);
        onEvent({ event: 'done', data: { response: 'Analysis complete! Found 12 pages with an average SEO score of 81. The blog section is performing well, but /en/products/backpacks needs SEO improvements (score: 65).' } });
      })();
      return controller;
    },
  });

  // Preview & Publish
  Object.assign(api, {
    previewPage: () => mock({ ok: true, url: 'https://main--wknd--adobe.aem.page/en/index' }),
    publishPage: () => mock({ ok: true, url: 'https://main--wknd--adobe.aem.live/en/index' }),
  });

  // Assets
  Object.assign(api, {
    listAssets: () => mock({ assets: MOCK_ASSETS }),
    uploadAsset: () => mock({ ok: true, asset: MOCK_ASSETS[0] }),
    updateAsset: () => mock({ ok: true }),
    deleteAsset: () => mock({ ok: true }),
    getAssetUrl: (_pid: string, path: string) => `https://placehold.co/800x600/2D3748/FFFFFF?text=${encodeURIComponent(path.split('/').pop() || 'image')}`,
    generateImage: () => mock({ ok: true, generation: { refinedPrompt: 'A stunning mountain landscape', suggestedAltText: 'Mountain vista at golden hour', suggestedTags: ['landscape', 'mountains'], suggestedFileName: 'mountain-vista.jpg' } }),
  });

  // Block Library & Blocks
  Object.assign(api, {
    getBlockLibrary: () => mock({ blocks: MOCK_BLOCKS }),
    getBlocks: () => mock({ blocks: MOCK_BLOCKS }),
    getBlock: (_pid: string, blockId: string) => mock({ block: { id: blockId, name: 'Hero', category: 'Layout', description: 'Full-width hero', structureHtml: '<div class="hero">...</div>', css: '.hero { min-height: 60vh; }', js: '', status: 'active', codePath: '', githubBranch: '', githubPrUrl: '', generativeConfig: {}, valueMetadata: {} } }),
    createBlock: () => mock({ ok: true, id: 'b-new' }),
    updateBlock: () => mock({ ok: true }),
    deleteBlock: () => mock({ ok: true }),
    generateBlock: () => mock({ ok: true, id: 'b-gen', block: { name: 'Testimonial', description: 'Customer testimonials carousel', category: 'Social Proof', structureHtml: '<div class="testimonial">...</div>', css: '.testimonial { padding: 3rem; }', js: '', variants: ['carousel', 'grid'], previewHtml: '<div>Preview</div>' } }, 1500),
    iterateBlock: () => mock({ ok: true, block: { name: 'Testimonial', description: 'Updated', category: 'Social Proof', structureHtml: '<div class="testimonial">...</div>', css: '', js: '', variants: [], previewHtml: '<div>Updated</div>' } }),
    commitBlock: () => mock({ ok: true, commit: { sha: 'abc123', branch: 'block/testimonial' }, pr: { number: 42, url: 'https://github.com/adobe/wknd/pull/42' } }),
    getBlockPreviewUrl: (_pid: string, blockId: string) => `https://placehold.co/600x400/3B63FB/FFFFFF?text=Block+${blockId}`,
  });

  // Design
  Object.assign(api, {
    generateDesign: () => mock({ ok: true, design: { tokens: { colors: { primary: '#E53E3E', secondary: '#2D3748' }, typography: { heading: 'Asar', body: 'Source Sans Pro' } }, css: ':root { --color-primary: #E53E3E; }', styleGuideHtml: '<div>Style Guide</div>' } }, 1000),
    bootstrapSite: () => mock({ ok: true, design: {}, pages: [{ path: '/en/index', title: 'Home', html: '<body>...</body>' }, { path: '/en/about', title: 'About', html: '<body>...</body>' }] }, 2000),
    getDesignTokens: () => mock({ tokens: { colors: { primary: '#E53E3E', secondary: '#2D3748', accent: '#ED8936' }, typography: { heading: 'Asar', body: 'Source Sans Pro' }, spacing: { base: '4px' } } }),
    updateDesignTokens: () => mock({ ok: true }),
    commitDesign: () => mock({ ok: true, commit: { sha: 'def456' }, pr: { number: 43, url: 'https://github.com/adobe/wknd/pull/43' } }),
    generateTheme: () => mock({ ok: true, theme: { light: { bg: '#FFFFFF', fg: '#1A202C' }, dark: { bg: '#1A202C', fg: '#E2E8F0' } } }),
  });

  // Generative config & monitoring
  Object.assign(api, {
    getGenerativeConfigs: () => mock({ configs: [{ id: 'gc-1', pathPattern: '/en/products/*', deliveryMode: 'generative', intentConfig: {}, confidenceThresholds: {}, signalConfig: {}, blockConstraints: {} }] }),
    upsertGenerativeConfig: () => mock({ ok: true }),
    deleteGenerativeConfig: () => mock({ ok: true }),
    getGenerativeRecent: () => mock({ generations: [{ id: 'gen-1', description: 'Generated product page', input: { query: 'hiking boots', intent: 'product_explore' }, output: { blocks: 4, persisted: '/en/products/boots' }, createdAt: new Date(Date.now() - 3600000).toISOString() }] }),
    getGenerativeStats: () => mock({ totalGenerations: 156, daily: [{ date: '2025-12-12', count: 12 }, { date: '2025-12-11', count: 18 }, { date: '2025-12-10', count: 15 }], performance: { avgLcp: 1.8, avgInp: 120, avgCls: 0.05, totalViews: 4520 } }),
  });

  // SEO
  Object.assign(api, {
    getSeoPages: () => mock({ pages: MOCK_SEO_PAGES }),
    getPageSeo: () => mock({ seo: MOCK_SEO_PAGES[0] }),
    updatePageSeo: () => mock({ ok: true }),
    analyzeSeo: () => mock({ ok: true, analysis: { seoScore: 87, llmCitabilityScore: 72, suggestedTitle: 'WKND Adventures - Premium Outdoor Gear & Expert Travel Guides', suggestedDescription: 'Shop premium hiking gear and explore expert-curated adventure travel guides.', suggestedKeywords: ['outdoor gear', 'hiking', 'adventure travel'], structuredData: { '@type': 'Organization' }, internalLinks: [{ targetPath: '/en/products', anchorText: 'Shop Gear', reason: 'High-converting product page' }], issues: [{ severity: 'warning', description: 'Meta description could be longer', fix: 'Expand to 150-160 characters' }], llmIssues: [{ description: 'Missing FAQ schema', fix: 'Add FAQ structured data for common questions' }] } }, 800),
    generateStructuredData: () => mock({ ok: true, structuredData: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'WKND Adventures' } }),
  });

  // Content Fragments
  Object.assign(api, {
    getFragmentModels: () => mock({ models: MOCK_FRAGMENT_MODELS }),
    createFragmentModel: () => mock({ ok: true, id: 'fm-new' }),
    updateFragmentModel: () => mock({ ok: true }),
    deleteFragmentModel: () => mock({ ok: true }),
    getFragments: () => mock({ fragments: MOCK_FRAGMENTS }),
    getFragment: () => mock({ fragment: { ...MOCK_FRAGMENTS[0], modelSchema: MOCK_FRAGMENT_MODELS[0].schema } }),
    createFragment: () => mock({ ok: true, id: 'cf-new' }),
    updateFragment: () => mock({ ok: true }),
    deleteFragment: () => mock({ ok: true }),
    generateFragmentContent: () => mock({ ok: true, generated: { title: 'AI Generated Article', slug: 'ai-generated', data: { title: 'AI Generated Article', author: 'Nova AI', category: 'Technology' } } }),
  });

  // Enterprise
  Object.assign(api, {
    getWorkflows: () => mock({ workflows: MOCK_WORKFLOWS }),
    createWorkflow: () => mock({ ok: true, id: 'wf-new' }),
    updateWorkflow: () => mock({ ok: true }),
    getWorkflowSteps: () => mock({ steps: [{ id: 'ws-1', order: 1, name: 'Content Review', type: 'review', status: 'completed', assignedTo: 'editor@adobe.com', completedBy: 'editor@adobe.com', comment: 'Looks good!', completedAt: '2025-12-11T14:00:00Z' }, { id: 'ws-2', order: 2, name: 'SEO Check', type: 'review', status: 'in_progress', assignedTo: 'seo@adobe.com', completedBy: null, comment: null, completedAt: null }] }),
    completeWorkflowStep: () => mock({ ok: true }),
    getLaunches: () => mock({ launches: MOCK_LAUNCHES }),
    createLaunch: () => mock({ ok: true, id: 'l-new', sourceBranch: 'launch-new' }),
    updateLaunch: () => mock({ ok: true }),
    deleteLaunch: () => mock({ ok: true }),
    getNotifications: () => mock({ notifications: MOCK_NOTIFICATIONS }),
    markNotificationRead: () => mock({ ok: true }),
    markAllNotificationsRead: () => mock({ ok: true }),
    getTranslations: () => mock({ translations: MOCK_TRANSLATIONS }),
    createTranslation: () => mock({ ok: true, id: 'tr-new', targetPath: '/fr/new', status: 'completed' }),
    updateTranslation: () => mock({ ok: true }),
    bulkOperation: () => mock({ ok: true, results: [{ path: '/en/index', ok: true }] }),
  });

  // Brand — persist to localStorage so data survives page reloads
  const BRAND_STORAGE_KEY = 'nova_brand_profiles';
  function loadBrandProfiles() {
    try {
      const stored = localStorage.getItem(BRAND_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as typeof MOCK_BRAND_PROFILES;
    } catch { /* fall through */ }
    // Seed from defaults on first load
    localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(MOCK_BRAND_PROFILES));
    return [...MOCK_BRAND_PROFILES];
  }
  function saveBrandProfiles(profiles: typeof MOCK_BRAND_PROFILES) {
    localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(profiles));
  }

  Object.assign(api, {
    getBrandProfiles: () => mock({ profiles: loadBrandProfiles() }),
    getBrandProfile: (_pid: string, name: string) => {
      const profiles = loadBrandProfiles();
      const profile = profiles.find((p) => p.name === name) || profiles[0];
      return mock({ profile });
    },
    saveBrandProfile: (_pid: string, name: string, data: { voice?: object; visual?: object; contentRules?: object; designTokens?: object }) => {
      const profiles = loadBrandProfiles();
      const idx = profiles.findIndex((p) => p.name === name);
      const updated = {
        id: idx >= 0 ? profiles[idx].id : `bp-${Date.now()}`,
        name,
        voice: (data.voice || {}) as typeof MOCK_BRAND_PROFILES[0]['voice'],
        visual: (data.visual || {}) as typeof MOCK_BRAND_PROFILES[0]['visual'],
        contentRules: (data.contentRules || {}) as Record<string, unknown>,
        designTokens: (data.designTokens || {}) as Record<string, string>,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) profiles[idx] = updated;
      else profiles.push(updated);
      saveBrandProfiles(profiles);
      return mock({ ok: true });
    },
    deleteBrandProfile: (_pid: string, name: string) => {
      const profiles = loadBrandProfiles().filter((p) => p.name !== name);
      saveBrandProfiles(profiles);
      return mock({ ok: true });
    },
    validateVoice: () => mock({ ok: true, validation: { score: 85, issues: [{ severity: 'warning', description: 'Slightly formal tone detected', suggestion: 'Consider more casual phrasing' }], strengths: ['Active voice used consistently', 'Good story-driven approach'], rewriteSuggestion: null } }),
    checkVisual: () => mock({ ok: true, check: { compliant: true, score: 92, issues: [], suggestions: ['Consider adding more white space'] } }),
    runBrandAudit: () => mock({ ok: true, audit: { overallScore: 88, summary: 'Brand consistency is strong across most pages', pages: [{ path: '/en/index', score: 92, issues: [], suggestions: [] }, { path: '/en/blog/adventure-awaits', score: 85, issues: ['Tone slightly informal in conclusion'], suggestions: ['Revise closing paragraph'] }], trends: ['Voice consistency improving over time'], recommendations: ['Update older product descriptions to match current voice guidelines'] } }, 1000),
  });
}
