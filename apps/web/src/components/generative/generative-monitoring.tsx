import { useState, useEffect, useCallback } from 'react';
import { api, type GenerationRecord, type GenerativeStats } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Badge } from '@/components/ui/badge';
import { Activity, BarChart3, Clock, Eye, Zap } from 'lucide-react';

export function GenerativeMonitoring() {
  const projectId = useProject((s) => s.activeProjectId);
  const [stats, setStats] = useState<GenerativeStats | null>(null);
  const [recent, setRecent] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [statsData, recentData] = await Promise.all([
        api.getGenerativeStats(projectId),
        api.getGenerativeRecent(projectId, 20),
      ]);
      setStats(statsData);
      setRecent(recentData.generations);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading monitoring data...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Total Generations"
          value={stats?.totalGenerations?.toString() || '0'}
        />
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          label="Total Views"
          value={stats?.performance?.totalViews?.toString() || '0'}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Avg LCP"
          value={stats?.performance?.avgLcp ? `${stats.performance.avgLcp.toFixed(1)}s` : 'N/A'}
          status={stats?.performance?.avgLcp && stats.performance.avgLcp < 2.5 ? 'good' : 'warn'}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Avg CLS"
          value={stats?.performance?.avgCls ? stats.performance.avgCls.toFixed(3) : 'N/A'}
          status={stats?.performance?.avgCls && stats.performance.avgCls < 0.1 ? 'good' : 'warn'}
        />
      </div>

      {/* Daily Chart (simple bar representation) */}
      {stats?.daily && stats.daily.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Daily Generations</h3>
          <div className="flex items-end gap-1 h-24">
            {stats.daily.map((d) => {
              const max = Math.max(...stats.daily.map((x) => x.count));
              const height = max > 0 ? (d.count / max) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/80 rounded-t min-h-[2px]"
                    style={{ height: `${height}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="text-[8px] text-muted-foreground">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Generations */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Recent Generations</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No generations recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((gen) => (
              <div key={gen.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{gen.description}</span>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(gen.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex gap-2">
                  {gen.input?.intent && (
                    <Badge variant="outline" className="text-[10px]">
                      {gen.input.intent}
                    </Badge>
                  )}
                  {gen.output?.blocks && (
                    <Badge variant="secondary" className="text-[10px]">
                      {gen.output.blocks} blocks
                    </Badge>
                  )}
                  {gen.output?.persisted && (
                    <Badge className="text-[10px]">
                      Saved: {gen.output.persisted}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, status }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status?: 'good' | 'warn';
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${
        status === 'good' ? 'text-green-600' : status === 'warn' ? 'text-amber-600' : ''
      }`}>
        {value}
      </div>
    </div>
  );
}
