/**
 * RAG context builder — assembles relevant context for AI operations.
 */

export interface RAGContext {
  recentActions: string;
  userContext: string;
  projectInfo: string;
}

export async function buildRAGContext(
  db: D1Database,
  userId: string,
  projectId: string,
): Promise<RAGContext> {
  // Recent actions
  const { results: actions } = await db
    .prepare(
      `SELECT action_type, description, created_at FROM action_history
       WHERE user_id = ? AND project_id = ?
       ORDER BY created_at DESC LIMIT 5`,
    )
    .bind(userId, projectId)
    .all();

  const recentActions = actions.length
    ? actions
        .map((a) => `- ${a.action_type}: ${a.description} (${a.created_at})`)
        .join('\n')
    : 'No recent actions.';

  // User context
  const userCtx = await db
    .prepare(
      `SELECT context_type, data FROM user_context
       WHERE user_id = ? AND project_id = ?`,
    )
    .bind(userId, projectId)
    .all();

  const userContext = userCtx.results.length
    ? userCtx.results.map((r) => `${r.context_type}: ${r.data}`).join('\n')
    : 'No accumulated user context.';

  // Project info
  const project = await db
    .prepare('SELECT name, slug, da_org, da_repo FROM projects WHERE id = ?')
    .bind(projectId)
    .first();

  const projectInfo = project
    ? `Project: ${project.name} (${project.slug}), DA: ${project.da_org}/${project.da_repo}`
    : 'Unknown project';

  return { recentActions, userContext, projectInfo };
}
