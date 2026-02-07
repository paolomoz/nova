import type { DAAdminClient } from '@nova/da-client';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
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
      description: 'Create a new page with HTML content. Use standard EDS block markup.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Page path (e.g. "/en/test")' },
          content: { type: 'string', description: 'HTML content for the page' },
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
      name: 'search_content',
      description: 'Search across all content using natural language. Returns matching pages with relevance scores.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
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
      return `Page created at ${input.path}`;
    }
    case 'delete_page': {
      await daClient.deleteSource(input.path);
      return `Page deleted at ${input.path}`;
    }
    case 'search_content': {
      // Phase 3: full semantic search
      return JSON.stringify({ message: 'Search not yet available', query: input.query });
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
