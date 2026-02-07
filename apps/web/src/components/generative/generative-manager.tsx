import { useState, useEffect, useCallback } from 'react';
import { api, type GenerativeConfigItem } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { GenerativeMonitoring } from './generative-monitoring';

export function GenerativeManager() {
  const projectId = useProject((s) => s.activeProjectId);
  const [configs, setConfigs] = useState<GenerativeConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GenerativeConfigItem | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConfigs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getGenerativeConfigs(projectId);
      setConfigs(data.configs);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const handleSave = async () => {
    if (!projectId || !editing) return;
    setSaving(true);
    try {
      await api.upsertGenerativeConfig(projectId, {
        pathPattern: editing.pathPattern,
        deliveryMode: editing.deliveryMode,
        intentConfig: editing.intentConfig,
        confidenceThresholds: editing.confidenceThresholds,
        signalConfig: editing.signalConfig,
        blockConstraints: editing.blockConstraints,
      });
      await loadConfigs();
      setEditing(null);
    } catch { /* handle error */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (configId: string) => {
    if (!projectId) return;
    await api.deleteGenerativeConfig(projectId, configId);
    loadConfigs();
  };

  const handleNew = () => {
    setEditing({
      id: '',
      pathPattern: '/**',
      deliveryMode: 'generative',
      intentConfig: { types: ['discovery', 'comparison', 'detail', 'support'] },
      confidenceThresholds: { minimum: 0.6, high: 0.85 },
      signalConfig: {},
      blockConstraints: { maxBlocks: 8 },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Generative Manager</h1>
        <p className="text-sm text-muted-foreground">
          Configure generative delivery, intent types, and block rules per path
        </p>
      </div>

      <Tabs defaultValue="config" className="flex-1 flex flex-col">
        <div className="px-6 pt-2">
          <TabsList>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config" className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-sm font-semibold">Path Configurations</h2>
            <Button size="sm" onClick={handleNew} className="gap-1">
              <Plus className="h-3 w-3" /> Add Config
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-lg border p-4 hover:bg-accent/50 cursor-pointer"
                  onClick={() => setEditing({ ...config })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {config.pathPattern}
                      </code>
                      <Badge variant={config.deliveryMode === 'generative' ? 'default' : 'secondary'}>
                        {config.deliveryMode}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(config.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {Array.isArray(config.intentConfig?.types) && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {(config.intentConfig.types as string[]).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {configs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No generative configs. Add one to enable AI-generated pages.
                </p>
              )}
            </div>
          )}

          {/* Edit panel */}
          {editing && (
            <div className="mt-6 rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-semibold">
                {editing.id ? 'Edit Configuration' : 'New Configuration'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Path Pattern</label>
                  <Input
                    value={editing.pathPattern}
                    onChange={(e) => setEditing({ ...editing, pathPattern: e.target.value })}
                    placeholder="e.g. /products/*, /**"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Delivery Mode</label>
                  <select
                    value={editing.deliveryMode}
                    onChange={(e) => setEditing({ ...editing, deliveryMode: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="static">Static</option>
                    <option value="generative">Generative</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Intent Types (comma-separated)</label>
                <Input
                  value={(editing.intentConfig?.types as string[] || []).join(', ')}
                  onChange={(e) => setEditing({
                    ...editing,
                    intentConfig: { ...editing.intentConfig, types: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                  })}
                  placeholder="discovery, comparison, detail, support"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Min Confidence</label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={(editing.confidenceThresholds?.minimum as number) || 0.6}
                    onChange={(e) => setEditing({
                      ...editing,
                      confidenceThresholds: { ...editing.confidenceThresholds, minimum: parseFloat(e.target.value) },
                    })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Max Blocks</label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={(editing.blockConstraints?.maxBlocks as number) || 8}
                    onChange={(e) => setEditing({
                      ...editing,
                      blockConstraints: { ...editing.blockConstraints, maxBlocks: parseInt(e.target.value, 10) },
                    })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="flex-1 overflow-y-auto p-6">
          <GenerativeMonitoring />
        </TabsContent>
      </Tabs>
    </div>
  );
}
