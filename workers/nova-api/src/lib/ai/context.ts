/**
 * RAG context builder — assembles relevant context for AI operations.
 */

export interface RAGContext {
  recentActions: string;
  userContext: string;
  projectInfo: string;
  semanticContext: string;
  valueInsights: string;
}

interface EnhancedContextParams {
  vectorize?: VectorizeIndex;
  voyageApiKey?: string;
  voyageModel?: string;
  query?: string;
}

export async function buildRAGContext(
  db: D1Database,
  userId: string,
  projectId: string,
  params?: EnhancedContextParams,
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

  // Semantic context (if Vectorize + Voyage available + query provided)
  let semanticContext = '';
  if (params?.vectorize && params?.voyageApiKey && params?.query) {
    semanticContext = await buildSemanticContext(
      params.vectorize,
      params.voyageApiKey,
      params.voyageModel || 'voyage-3',
      params.query,
      projectId,
    );
  }

  // Value insights
  const valueInsights = await buildValueInsights(db, projectId);

  return { recentActions, userContext, projectInfo, semanticContext, valueInsights };
}

async function buildSemanticContext(
  vectorize: VectorizeIndex,
  voyageApiKey: string,
  voyageModel: string,
  query: string,
  projectId: string,
): Promise<string> {
  try {
    // Embed the user query via Voyage with 3s timeout (Vectorize cold start safety)
    const embeddingPromise = (async () => {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${voyageApiKey}`,
        },
        body: JSON.stringify({ input: [query], model: voyageModel }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
      return data.data[0]?.embedding ?? null;
    })();

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const queryVector = await Promise.race([embeddingPromise, timeoutPromise]);
    if (!queryVector) return '';

    const vectorResults = await vectorize.query(queryVector, {
      topK: 5,
      filter: { projectId },
      returnMetadata: 'all',
    });

    if (!vectorResults.matches.length) return '';

    const lines = vectorResults.matches.map((m) => {
      const path = (m.metadata?.path as string) || 'unknown';
      const title = (m.metadata?.title as string) || path;
      const snippet = (m.metadata?.snippet as string) || '';
      return `- ${title} (${path}, relevance: ${m.score.toFixed(2)}): ${snippet.slice(0, 100)}`;
    });

    return `Related content:\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

async function buildValueInsights(db: D1Database, projectId: string): Promise<string> {
  try {
    // Top 5 performing pages
    const { results: topPages } = await db.prepare(
      `SELECT path, composite_score FROM value_scores
       WHERE project_id = ? AND composite_score IS NOT NULL
       ORDER BY composite_score DESC LIMIT 5`,
    ).bind(projectId).all();

    // Bottom 3 pages needing improvement
    const { results: bottomPages } = await db.prepare(
      `SELECT path, composite_score FROM value_scores
       WHERE project_id = ? AND composite_score IS NOT NULL AND composite_score > 0
       ORDER BY composite_score ASC LIMIT 3`,
    ).bind(projectId).all();

    const lines: string[] = [];
    if (topPages.length) {
      lines.push('Top performing pages:');
      for (const p of topPages) {
        lines.push(`- ${p.path} (score: ${(p.composite_score as number).toFixed(2)})`);
      }
    }
    if (bottomPages.length) {
      lines.push('Pages needing improvement:');
      for (const p of bottomPages) {
        lines.push(`- ${p.path} (score: ${(p.composite_score as number).toFixed(2)})`);
      }
    }

    return lines.length ? lines.join('\n') : '';
  } catch {
    return '';
  }
}
