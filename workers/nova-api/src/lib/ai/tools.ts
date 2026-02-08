import type { DAAdminClient } from '@nova/da-client';

export interface ToolContext {
  daClient: DAAdminClient;
  db: D1Database;
  vectorize?: VectorizeIndex;
  userId: string;
  projectId: string;
  voyageApiKey: string;
  voyageModel: string;
  embedQueue?: Queue;
  anthropicApiKey?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'list_pages',
      description: 'List all pages and folders in a directory. Returns name, path, and type for each item.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (e.g. "/en", "/"). Defaults to "/".' },
        },
        required: [],
      },
    },
    {
      name: 'read_page',
      description: 'Read the HTML source content of a page.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path (e.g. "/en/index")' },
        },
        required: ['path'],
      },
    },
    {
      name: 'create_page',
      description: `Create a new page with HTML content using EDS block markup.

EDS block structure rules:
- A block is: <div class="block-name"><div>...rows...</div></div>
- Each row is a direct child <div> of the block. Each cell is a direct child <div> of a row.
- Columns: ONE row with N cells (not N rows with 1 cell). Example: <div class="columns"><div><div>Col1</div><div>Col2</div></div></div>
- Cards: N rows, each row is one card. Each card row has cells (e.g. image cell + text cell). Example: <div class="cards"><div><div><picture><img></picture></div><div><h3>Title</h3><p>Text</p></div></div></div>
- Accordion: N rows, each row has a question cell + answer cell. Example: <div class="accordion"><div><div><h3>Q?</h3></div><div><p>Answer</p></div></div></div>
- Tabs: N rows, each row has a label cell + content cell.
- Hero: 1 row with image cell + text cell.
- Images use <picture><img src="..." alt="..."></picture>.
- Section breaks: <hr>. Section metadata: <div class="section-metadata"><div><div>key</div><div>value</div></div></div> placed BEFORE the <hr>.
- Variants are space-separated classes: <div class="cards horizontal">.`,
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path (e.g. "/en/test")' },
          content: { type: 'string', description: 'HTML content for the page using EDS block markup' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'delete_page',
      description: 'Delete a page or folder.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete' },
        },
        required: ['path'],
      },
    },
    {
      name: 'copy_page',
      description: 'Copy a page or folder to a new location.',
      input_schema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path to copy from' },
          destination: { type: 'string', description: 'Destination path to copy to' },
        },
        required: ['source', 'destination'],
      },
    },
    {
      name: 'move_page',
      description: 'Move a page or folder to a new location. Also used for renaming (same parent directory, different name).',
      input_schema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path' },
          destination: { type: 'string', description: 'Destination path' },
        },
        required: ['source', 'destination'],
      },
    },
    {
      name: 'search_content',
      description: 'Search across all content using keywords. Returns matching pages with titles and snippets.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_page_properties',
      description: 'Get page properties including delivery mode (static/generative/hybrid) and value annotations.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path' },
        },
        required: ['path'],
      },
    },
    {
      name: 'set_delivery_mode',
      description: 'Set the delivery mode for a page path. Controls whether content is served statically, generated dynamically, or hybrid.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path or glob pattern (e.g. "/products/*")' },
          mode: { type: 'string', description: 'Delivery mode', enum: ['static', 'generative', 'hybrid'] },
        },
        required: ['path', 'mode'],
      },
    },
    {
      name: 'get_action_history',
      description: 'Get recent user actions. Useful for understanding context of what the user has been doing.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Number of recent actions to return (default 10)' },
        },
        required: [],
      },
    },
    {
      name: 'get_brand_profile',
      description: 'Get the brand profile for the project including voice, visual, and content rules.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_block_library',
      description: 'Get the EDS block catalog with structures, variants, and generative config. Use this to understand what blocks are available when creating or editing pages.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_value_scores',
      description: 'Get content value scores for pages. Scores include engagement, conversion, CWV, SEO, and composite.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional page path to filter by. Omit for all pages.' },
        },
        required: [],
      },
    },
    {
      name: 'get_telemetry',
      description: 'Get page telemetry data including page views and Core Web Vitals (LCP, INP, CLS).',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path to get telemetry for' },
          days: { type: 'string', description: 'Number of days to look back (default 30)' },
        },
        required: [],
      },
    },
    {
      name: 'update_generative_config',
      description: 'Update generative config for a path pattern: delivery mode, intent types, confidence thresholds.',
      input_schema: {
        type: 'object',
        properties: {
          path_pattern: { type: 'string', description: 'Path or glob pattern (e.g. "/products/*")' },
          delivery_mode: { type: 'string', description: 'Delivery mode', enum: ['static', 'generative', 'hybrid'] },
          intent_config: { type: 'string', description: 'JSON string of intent configuration' },
          confidence_thresholds: { type: 'string', description: 'JSON string of confidence thresholds' },
        },
        required: ['path_pattern'],
      },
    },
    {
      name: 'semantic_search',
      description: 'Search content using semantic similarity. Embeds the query via Voyage AI and queries Vectorize for related content.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          limit: { type: 'string', description: 'Number of results (default 5)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'generate_block',
      description: 'Generate a new EDS block using AI. Produces HTML structure, CSS, and JS for the block based on a description. The block is saved as a draft in the block library.',
      input_schema: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: 'Description of the block to generate (e.g. "a pricing table with 3 tiers and a toggle for monthly/annual")' },
        },
        required: ['intent'],
      },
    },
    {
      name: 'update_block',
      description: 'Update an existing block in the library with AI-generated changes. Provide feedback to iterate on the block design.',
      input_schema: {
        type: 'object',
        properties: {
          block_name: { type: 'string', description: 'Name of the block to update' },
          feedback: { type: 'string', description: 'Description of changes to make (e.g. "make the cards larger and add a hover effect")' },
        },
        required: ['block_name', 'feedback'],
      },
    },
  ];
}

export async function executeTool(
  name: string,
  input: Record<string, string>,
  ctx: ToolContext,
): Promise<string> {
  const { daClient, db, userId, projectId } = ctx;

  switch (name) {
    case 'list_pages': {
      const items = await daClient.list(input.path || '/');
      return JSON.stringify(items, null, 2);
    }
    case 'read_page': {
      const source = await daClient.getSource(input.path);
      return source.content;
    }
    case 'create_page': {
      await daClient.putSource(input.path, input.content);
      await logAction(db, userId, projectId, 'create_page', `AI created page at ${input.path}`, { path: input.path });
      // Trigger embed queue
      try {
        if (ctx.embedQueue) {
          await ctx.embedQueue.send({ type: 'content', projectId, path: input.path, html: input.content });
        }
      } catch {
        // Non-fatal
      }
      return `Page created at ${input.path}`;
    }
    case 'delete_page': {
      await daClient.deleteSource(input.path);
      await logAction(db, userId, projectId, 'delete_page', `AI deleted page at ${input.path}`, { path: input.path });
      return `Page deleted at ${input.path}`;
    }
    case 'copy_page': {
      await daClient.copy(input.source, input.destination);
      await logAction(db, userId, projectId, 'copy_page', `AI copied ${input.source} to ${input.destination}`, { source: input.source, destination: input.destination });
      return `Copied ${input.source} to ${input.destination}`;
    }
    case 'move_page': {
      await daClient.move(input.source, input.destination);
      const isRename = input.source.split('/').slice(0, -1).join('/') === input.destination.split('/').slice(0, -1).join('/');
      const actionType = isRename ? 'rename_page' : 'move_page';
      const desc = isRename
        ? `AI renamed ${input.source.split('/').pop()} to ${input.destination.split('/').pop()}`
        : `AI moved ${input.source} to ${input.destination}`;
      await logAction(db, userId, projectId, actionType, desc, { source: input.source, destination: input.destination });
      return isRename
        ? `Renamed to ${input.destination.split('/').pop()}`
        : `Moved ${input.source} to ${input.destination}`;
    }
    case 'search_content': {
      const keywords = input.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (keywords.length === 0) return JSON.stringify({ results: [] });

      const conditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(body) LIKE ?)').join(' AND ');
      const bindings: string[] = [projectId];
      for (const kw of keywords) {
        bindings.push(`%${kw}%`, `%${kw}%`);
      }

      const { results } = await db
        .prepare(`SELECT path, title, substr(body, 1, 200) as snippet FROM content_index WHERE project_id = ? AND ${conditions} LIMIT 10`)
        .bind(...bindings)
        .all();
      return JSON.stringify(results, null, 2);
    }
    case 'get_page_properties': {
      const config = await db.prepare(
        `SELECT delivery_mode FROM generative_config
         WHERE project_id = ? AND (path_pattern = ? OR ? GLOB path_pattern)
         ORDER BY length(path_pattern) DESC LIMIT 1`,
      ).bind(projectId, input.path, input.path).first<{ delivery_mode: string }>();

      const { results: annotations } = await db.prepare(
        'SELECT audience, situation, outcome, composite_score FROM value_scores WHERE project_id = ? AND path = ?',
      ).bind(projectId, input.path).all();

      return JSON.stringify({
        path: input.path,
        deliveryMode: config?.delivery_mode || 'static',
        annotations,
      }, null, 2);
    }
    case 'set_delivery_mode': {
      await db.prepare(
        `INSERT INTO generative_config (id, project_id, path_pattern, delivery_mode)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, path_pattern) DO UPDATE SET
           delivery_mode = excluded.delivery_mode, updated_at = datetime('now')`,
      ).bind(crypto.randomUUID(), projectId, input.path, input.mode).run();
      await logAction(db, userId, projectId, 'set_delivery_mode', `AI set ${input.path} to ${input.mode}`, { path: input.path, mode: input.mode });
      return `Delivery mode for ${input.path} set to ${input.mode}`;
    }
    case 'get_action_history': {
      const limit = parseInt(input.limit || '10', 10);
      const { results } = await db
        .prepare(
          `SELECT action_type, description, created_at FROM action_history
           WHERE user_id = ? AND project_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(userId, projectId, limit)
        .all();
      return JSON.stringify(results, null, 2);
    }
    case 'get_brand_profile': {
      const profile = await db.prepare(
        `SELECT name, voice, visual, content_rules, design_tokens FROM brand_profiles
         WHERE project_id = ? ORDER BY name LIMIT 1`,
      ).bind(projectId).first();

      if (!profile) return JSON.stringify({ message: 'No brand profile configured for this project.' });
      return JSON.stringify({
        name: profile.name,
        voice: JSON.parse((profile.voice as string) || '{}'),
        visual: JSON.parse((profile.visual as string) || '{}'),
        contentRules: JSON.parse((profile.content_rules as string) || '{}'),
        designTokens: JSON.parse((profile.design_tokens as string) || '{}'),
      }, null, 2);
    }
    case 'get_block_library': {
      const { getBlockLibrary } = await import('../blocks.js');
      const blocks = await getBlockLibrary(db, projectId);
      return JSON.stringify(blocks, null, 2);
    }
    case 'get_value_scores': {
      let query = 'SELECT path, engagement_score, conversion_score, cwv_score, seo_score, composite_score, sample_size FROM value_scores WHERE project_id = ?';
      const bindings: string[] = [projectId];
      if (input.path) {
        query += ' AND path = ?';
        bindings.push(input.path);
      }
      query += ' ORDER BY composite_score DESC LIMIT 50';
      const { results } = await db.prepare(query).bind(...bindings).all();
      return JSON.stringify(results, null, 2);
    }
    case 'get_telemetry': {
      const days = parseInt(input.days || '30', 10);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      let query = 'SELECT path, date, page_views, lcp_p75, inp_p75, cls_p75, conversion_events FROM telemetry_daily WHERE project_id = ? AND date >= ?';
      const bindings: string[] = [projectId, since];
      if (input.path) {
        query += ' AND path = ?';
        bindings.push(input.path);
      }
      query += ' ORDER BY date DESC LIMIT 100';
      const { results } = await db.prepare(query).bind(...bindings).all();
      return JSON.stringify(results, null, 2);
    }
    case 'update_generative_config': {
      const updates: Record<string, string> = {};
      if (input.delivery_mode) updates.delivery_mode = input.delivery_mode;
      if (input.intent_config) updates.intent_config = input.intent_config;
      if (input.confidence_thresholds) updates.confidence_thresholds = input.confidence_thresholds;

      await db.prepare(
        `INSERT INTO generative_config (id, project_id, path_pattern, delivery_mode, intent_config, confidence_thresholds)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, path_pattern) DO UPDATE SET
           delivery_mode = COALESCE(excluded.delivery_mode, generative_config.delivery_mode),
           intent_config = COALESCE(excluded.intent_config, generative_config.intent_config),
           confidence_thresholds = COALESCE(excluded.confidence_thresholds, generative_config.confidence_thresholds),
           updated_at = datetime('now')`,
      ).bind(
        crypto.randomUUID(),
        projectId,
        input.path_pattern,
        input.delivery_mode || 'static',
        input.intent_config || '{}',
        input.confidence_thresholds || '{}',
      ).run();
      await logAction(db, userId, projectId, 'update_generative_config', `AI updated generative config for ${input.path_pattern}`, input);
      return `Generative config updated for ${input.path_pattern}`;
    }
    case 'semantic_search': {
      if (!ctx.voyageApiKey) return JSON.stringify({ error: 'Voyage API not configured', results: [] });
      const limit = parseInt(input.limit || '5', 10);

      // Embed query via Voyage
      const embResponse = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.voyageApiKey}`,
        },
        body: JSON.stringify({ input: [input.query], model: ctx.voyageModel || 'voyage-3' }),
      });
      if (!embResponse.ok) return JSON.stringify({ error: 'Failed to generate embedding', results: [] });
      const embData = (await embResponse.json()) as { data: Array<{ embedding: number[] }> };
      const queryVector = embData.data[0]?.embedding;
      if (!queryVector) return JSON.stringify({ error: 'No embedding returned', results: [] });

      // Query Vectorize
      if (!ctx.vectorize) return JSON.stringify({ error: 'Vectorize not configured', results: [] });
      const vectorResults = await ctx.vectorize.query(queryVector, {
        topK: limit,
        filter: { projectId },
        returnMetadata: 'all',
      });

      const results = vectorResults.matches.map((m) => ({
        path: (m.metadata?.path as string) || '',
        title: (m.metadata?.title as string) || '',
        snippet: (m.metadata?.snippet as string) || '',
        score: m.score,
      }));
      return JSON.stringify(results, null, 2);
    }
    case 'generate_block': {
      const { generateBlock } = await import('./block-generator.js');
      const { getBlockLibrary } = await import('../blocks.js');

      const library = await getBlockLibrary(db, projectId);
      const brand = await db.prepare(
        'SELECT voice, visual, content_rules, design_tokens FROM brand_profiles WHERE project_id = ? LIMIT 1',
      ).bind(projectId).first();
      const brandProfile = brand ? {
        voice: JSON.parse((brand.voice as string) || '{}'),
        visual: JSON.parse((brand.visual as string) || '{}'),
        contentRules: JSON.parse((brand.content_rules as string) || '{}'),
        designTokens: JSON.parse((brand.design_tokens as string) || '{}'),
      } : null;

      const generated = await generateBlock(input.intent, library, brandProfile, {
        ANTHROPIC_API_KEY: ctx.anthropicApiKey || '',
      });

      // Save draft
      const blockId = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO block_library (id, project_id, name, category, description, structure_html, css, js, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
         ON CONFLICT(project_id, name) DO UPDATE SET
           category = excluded.category, description = excluded.description,
           structure_html = excluded.structure_html, css = excluded.css, js = excluded.js,
           status = 'draft', updated_at = datetime('now')`,
      ).bind(blockId, projectId, generated.name, generated.category, generated.description,
        generated.structureHtml, generated.css, generated.js).run();

      await logAction(db, userId, projectId, 'generate_block', `AI generated block: ${generated.name}`, { intent: input.intent });
      return `Generated block "${generated.name}" (${generated.category}): ${generated.description}. CSS: ${generated.css.length} chars, JS: ${generated.js.length} chars. Saved as draft.`;
    }
    case 'update_block': {
      const { iterateBlock } = await import('./block-generator.js');
      const existing = await db.prepare(
        'SELECT * FROM block_library WHERE project_id = ? AND name = ?',
      ).bind(projectId, input.block_name).first();

      if (!existing) return `Block "${input.block_name}" not found in library.`;

      const currentBlock = {
        name: existing.name as string,
        description: (existing.description as string) || '',
        category: (existing.category as string) || 'Content',
        structureHtml: (existing.structure_html as string) || '',
        css: (existing.css as string) || '',
        js: (existing.js as string) || '',
        variants: [] as string[],
        previewHtml: '',
      };

      const updated = await iterateBlock(currentBlock, input.feedback, [], {
        ANTHROPIC_API_KEY: ctx.anthropicApiKey || '',
      });

      await db.prepare(
        `UPDATE block_library SET description = ?, structure_html = ?, css = ?, js = ?, updated_at = datetime('now')
         WHERE project_id = ? AND name = ?`,
      ).bind(updated.description, updated.structureHtml, updated.css, updated.js, projectId, input.block_name).run();

      await logAction(db, userId, projectId, 'update_block', `AI updated block: ${input.block_name}`, { feedback: input.feedback });
      return `Updated block "${input.block_name}": ${updated.description}`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

function logAction(
  db: D1Database,
  userId: string,
  projectId: string,
  actionType: string,
  description: string,
  input: Record<string, unknown>,
) {
  return db
    .prepare(
      `INSERT INTO action_history (id, user_id, project_id, action_type, description, input)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), userId, projectId, actionType, description, JSON.stringify(input))
    .run();
}
