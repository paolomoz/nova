import { useState, useEffect } from 'react';
import { api, type PageProperties } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { X, Plus, Globe, Sparkles, Combine, Loader2 } from 'lucide-react';

interface PropertiesPanelProps {
  projectId: string;
  path: string;
  onClose: () => void;
}

export function PropertiesPanel({ projectId, path, onClose }: PropertiesPanelProps) {
  const [properties, setProperties] = useState<PageProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAudience, setNewAudience] = useState('');
  const [newSituation, setNewSituation] = useState('');
  const [newOutcome, setNewOutcome] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getProperties(projectId, path).then((p) => {
      setProperties(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId, path]);

  const handleDeliveryModeChange = async (mode: string) => {
    setSaving(true);
    await api.updateProperties(projectId, { path, deliveryMode: mode });
    setProperties((prev) => prev ? { ...prev, deliveryMode: mode } : null);
    setSaving(false);
  };

  const handleAddAnnotation = async () => {
    if (!newAudience && !newSituation && !newOutcome) return;
    setSaving(true);
    await api.updateProperties(projectId, {
      path,
      annotation: {
        audience: newAudience || undefined,
        situation: newSituation || undefined,
        outcome: newOutcome || undefined,
      },
    });
    // Reload
    const p = await api.getProperties(projectId, path);
    setProperties(p);
    setNewAudience('');
    setNewSituation('');
    setNewOutcome('');
    setSaving(false);
  };

  const handleRemoveAnnotation = async (id: string) => {
    await api.deleteAnnotation(projectId, id);
    setProperties((prev) =>
      prev ? { ...prev, annotations: prev.annotations.filter((a) => a.id !== id) } : null,
    );
  };

  const deliveryModeIcon = {
    static: <Globe className="h-4 w-4" />,
    generative: <Sparkles className="h-4 w-4" />,
    hybrid: <Combine className="h-4 w-4" />,
  };

  if (loading) {
    return (
      <div className="flex h-full w-80 items-center justify-center border-l">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-80 flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Properties</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Path */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Path</label>
          <p className="mt-1 text-sm font-mono">{path}</p>
        </div>

        {/* Delivery Mode */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Delivery Mode</label>
          <Select
            value={properties?.deliveryMode || 'static'}
            onValueChange={handleDeliveryModeChange}
            disabled={saving}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static">
                <span className="flex items-center gap-2">{deliveryModeIcon.static} Static</span>
              </SelectItem>
              <SelectItem value="generative">
                <span className="flex items-center gap-2">{deliveryModeIcon.generative} Generative</span>
              </SelectItem>
              <SelectItem value="hybrid">
                <span className="flex items-center gap-2">{deliveryModeIcon.hybrid} Hybrid</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            {properties?.deliveryMode === 'static' && 'Content served as authored.'}
            {properties?.deliveryMode === 'generative' && 'Content generated dynamically at the edge.'}
            {properties?.deliveryMode === 'hybrid' && 'Static scaffold with generative zones.'}
          </p>
        </div>

        <Separator />

        {/* Value Annotations */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Content Value Annotations</label>
          <div className="mt-2 space-y-2">
            {properties?.annotations.map((ann, i) => (
              <div key={ann.id || i} className="flex items-start gap-1 rounded-md border p-2 text-xs">
                <div className="flex-1 space-y-1">
                  {ann.audience && <Badge variant="secondary">{ann.audience}</Badge>}
                  {ann.situation && <Badge variant="outline">{ann.situation}</Badge>}
                  {ann.outcome && <Badge variant="default">{ann.outcome}</Badge>}
                  {ann.composite_score != null && (
                    <span className="ml-1 text-muted-foreground">Score: {ann.composite_score.toFixed(1)}</span>
                  )}
                </div>
                {ann.id && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveAnnotation(ann.id!)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {(!properties?.annotations || properties.annotations.length === 0) && (
              <p className="text-xs text-muted-foreground">No annotations yet.</p>
            )}
          </div>

          {/* Add annotation */}
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Audience (e.g. developers, marketers)"
              value={newAudience}
              onChange={(e) => setNewAudience(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Situation (e.g. mobile, organic search)"
              value={newSituation}
              onChange={(e) => setNewSituation(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Outcome (e.g. signup, purchase)"
              value={newOutcome}
              onChange={(e) => setNewOutcome(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={handleAddAnnotation} disabled={saving} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Add Annotation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
