/**
 * Context accumulation — tracks user patterns after each AI execution.
 * No LLM calls — lightweight pattern matching on tool names and paths.
 */

interface AccumulationInput {
  prompt: string;
  toolCalls: Array<{ name: string; input: Record<string, string> }>;
}

export async function accumulateContext(
  db: D1Database,
  userId: string,
  projectId: string,
  input: AccumulationInput,
): Promise<void> {
  try {
    await Promise.all([
      updateToolFrequency(db, userId, projectId, input.toolCalls),
      updateExpertiseLevel(db, userId, projectId, input.prompt),
      updateActivePaths(db, userId, projectId, input.toolCalls),
    ]);
  } catch {
    // Non-fatal: context accumulation failures should never block
  }
}

async function updateToolFrequency(
  db: D1Database,
  userId: string,
  projectId: string,
  toolCalls: Array<{ name: string }>,
): Promise<void> {
  if (toolCalls.length === 0) return;

  const existing = await db.prepare(
    `SELECT data FROM user_context WHERE user_id = ? AND project_id = ? AND context_type = 'tool_frequency'`,
  ).bind(userId, projectId).first<{ data: string }>();

  const freq: Record<string, number> = existing ? JSON.parse(existing.data) : {};
  for (const call of toolCalls) {
    freq[call.name] = (freq[call.name] || 0) + 1;
  }

  await db.prepare(
    `INSERT INTO user_context (user_id, project_id, context_type, data, updated_at)
     VALUES (?, ?, 'tool_frequency', ?, datetime('now'))
     ON CONFLICT(user_id, project_id, context_type) DO UPDATE SET
       data = excluded.data, updated_at = datetime('now')`,
  ).bind(userId, projectId, JSON.stringify(freq)).run();
}

async function updateExpertiseLevel(
  db: D1Database,
  userId: string,
  projectId: string,
  prompt: string,
): Promise<void> {
  // Simple heuristics for expertise level
  const advancedPatterns = [
    /delivery mode/i, /generative/i, /config/i, /telemetry/i,
    /value score/i, /cwv/i, /lcp/i, /conversion/i, /semantic/i,
    /brand profile/i, /block library/i, /section-metadata/i,
  ];
  const intermediatePatterns = [
    /template/i, /copy.*to/i, /move.*to/i, /rename/i,
    /search/i, /accordion/i, /tabs/i, /carousel/i,
  ];

  const advancedCount = advancedPatterns.filter((p) => p.test(prompt)).length;
  const intermediateCount = intermediatePatterns.filter((p) => p.test(prompt)).length;

  let level = 'beginner';
  if (advancedCount >= 2) level = 'advanced';
  else if (advancedCount >= 1 || intermediateCount >= 2) level = 'intermediate';

  // Only upgrade, never downgrade
  const existing = await db.prepare(
    `SELECT data FROM user_context WHERE user_id = ? AND project_id = ? AND context_type = 'expertise_level'`,
  ).bind(userId, projectId).first<{ data: string }>();

  const levels = ['beginner', 'intermediate', 'advanced'];
  const currentIdx = existing ? levels.indexOf(existing.data) : -1;
  const newIdx = levels.indexOf(level);
  if (newIdx <= currentIdx) return;

  await db.prepare(
    `INSERT INTO user_context (user_id, project_id, context_type, data, updated_at)
     VALUES (?, ?, 'expertise_level', ?, datetime('now'))
     ON CONFLICT(user_id, project_id, context_type) DO UPDATE SET
       data = excluded.data, updated_at = datetime('now')`,
  ).bind(userId, projectId, level).run();
}

async function updateActivePaths(
  db: D1Database,
  userId: string,
  projectId: string,
  toolCalls: Array<{ name: string; input: Record<string, string> }>,
): Promise<void> {
  // Extract paths from tool calls
  const paths = new Set<string>();
  for (const call of toolCalls) {
    if (call.input.path) paths.add(call.input.path);
    if (call.input.source) paths.add(call.input.source);
    if (call.input.destination) paths.add(call.input.destination);
  }
  if (paths.size === 0) return;

  const existing = await db.prepare(
    `SELECT data FROM user_context WHERE user_id = ? AND project_id = ? AND context_type = 'active_paths'`,
  ).bind(userId, projectId).first<{ data: string }>();

  const activePaths: string[] = existing ? JSON.parse(existing.data) : [];
  for (const p of paths) {
    // Remove duplicates, add to front
    const idx = activePaths.indexOf(p);
    if (idx !== -1) activePaths.splice(idx, 1);
    activePaths.unshift(p);
  }
  // Keep most recent 20
  const trimmed = activePaths.slice(0, 20);

  await db.prepare(
    `INSERT INTO user_context (user_id, project_id, context_type, data, updated_at)
     VALUES (?, ?, 'active_paths', ?, datetime('now'))
     ON CONFLICT(user_id, project_id, context_type) DO UPDATE SET
       data = excluded.data, updated_at = datetime('now')`,
  ).bind(userId, projectId, JSON.stringify(trimmed)).run();
}
