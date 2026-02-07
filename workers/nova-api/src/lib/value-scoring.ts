/**
 * Value score computation — reads 30-day telemetry and computes composite scores.
 */

interface TelemetryRow {
  path: string;
  total_views: number;
  avg_lcp: number | null;
  avg_inp: number | null;
  avg_cls: number | null;
  total_conversions: number;
  days: number;
}

export async function computeValueScores(db: D1Database, projectId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Aggregate 30-day telemetry per path
  const { results } = await db.prepare(
    `SELECT
       path,
       SUM(page_views) as total_views,
       AVG(lcp_p75) as avg_lcp,
       AVG(inp_p75) as avg_inp,
       AVG(cls_p75) as avg_cls,
       SUM(conversion_events) as total_conversions,
       COUNT(DISTINCT date) as days
     FROM telemetry_daily
     WHERE project_id = ? AND date >= ?
     GROUP BY path`,
  ).bind(projectId, since).all<TelemetryRow>();

  if (!results || results.length === 0) return 0;

  // Compute site-wide averages for normalization
  const totalViews = results.reduce((sum, r) => sum + (r.total_views || 0), 0);
  const avgViews = totalViews / results.length;

  let updated = 0;

  for (const row of results) {
    // Engagement: normalized page views relative to site average
    const engagement = avgViews > 0 ? Math.min((row.total_views || 0) / avgViews, 1) : 0;

    // CWV score: LCP < 2.5s = 1, < 4s = 0.5, else 0 (same pattern for INP@200ms, CLS@0.1)
    const lcpScore = row.avg_lcp == null ? 0.5 : row.avg_lcp < 2500 ? 1 : row.avg_lcp < 4000 ? 0.5 : 0;
    const inpScore = row.avg_inp == null ? 0.5 : row.avg_inp < 200 ? 1 : row.avg_inp < 500 ? 0.5 : 0;
    const clsScore = row.avg_cls == null ? 0.5 : row.avg_cls < 0.1 ? 1 : row.avg_cls < 0.25 ? 0.5 : 0;
    const cwv = (lcpScore + inpScore + clsScore) / 3;

    // Conversion: normalized (simple: any conversions = better)
    const conversion = totalViews > 0
      ? Math.min((row.total_conversions || 0) / Math.max(row.total_views || 1, 1), 1)
      : 0;

    // SEO: placeholder (would need external data). Use engagement as proxy.
    const seo = engagement * 0.8;

    // Composite: engagement*0.3 + conversion*0.3 + cwv*0.25 + seo*0.15
    const composite = engagement * 0.3 + conversion * 0.3 + cwv * 0.25 + seo * 0.15;

    await db.prepare(
      `INSERT INTO value_scores (id, project_id, path, engagement_score, conversion_score, cwv_score, seo_score, composite_score, sample_size, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(project_id, path, audience, situation) DO UPDATE SET
         engagement_score = excluded.engagement_score,
         conversion_score = excluded.conversion_score,
         cwv_score = excluded.cwv_score,
         seo_score = excluded.seo_score,
         composite_score = excluded.composite_score,
         sample_size = excluded.sample_size,
         updated_at = datetime('now')`,
    ).bind(
      crypto.randomUUID(),
      projectId,
      row.path,
      Math.round(engagement * 100) / 100,
      Math.round(conversion * 100) / 100,
      Math.round(cwv * 100) / 100,
      Math.round(seo * 100) / 100,
      Math.round(composite * 100) / 100,
      row.total_views || 0,
    ).run();

    updated++;
  }

  return updated;
}
