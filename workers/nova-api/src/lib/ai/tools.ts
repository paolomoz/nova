import type { DAAdminClient } from '@nova/da-client';

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
  ];
}

export async function executeTool(
  name: string,
  input: Record<string, string>,
  daClient: DAAdminClient,
  db: D1Database,
  userId: string,
  projectId: string,
): Promise<string> {
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
