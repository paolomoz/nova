import { useState, useEffect, useCallback } from 'react';
import { api, type FragmentModel, type ContentFragment } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Trash2, Save, Sparkles, FileJson, Database,
} from 'lucide-react';

export function FragmentManager() {
  const projectId = useProject((s) => s.activeProjectId);
  const [models, setModels] = useState<FragmentModel[]>([]);
  const [fragments, setFragments] = useState<ContentFragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showFragmentDialog, setShowFragmentDialog] = useState(false);
  const [editingFragment, setEditingFragment] = useState<ContentFragment | null>(null);

  const loadModels = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getFragmentModels(projectId);
      setModels(data.models);
      if (data.models.length > 0 && !activeModel) setActiveModel(data.models[0].id);
    } catch { /* non-fatal */ }
  }, [projectId]);

  const loadFragments = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getFragments(projectId, activeModel || undefined);
      setFragments(data.fragments);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId, activeModel]);

  useEffect(() => { loadModels(); }, [loadModels]);
  useEffect(() => { loadFragments(); }, [loadFragments]);

  const handleDeleteFragment = async (id: string) => {
    if (!projectId) return;
    await api.deleteFragment(projectId, id);
    loadFragments();
  };

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Select a project first</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Content Fragments</h1>
        <div className="flex gap-1 ml-4">
          {models.map((m) => (
            <Button
              key={m.id}
              variant={activeModel === m.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveModel(m.id)}
            >
              {m.name}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowModelDialog(true)}>
            <Database className="h-4 w-4 mr-1" /> New Model
          </Button>
          <Button size="sm" onClick={() => setShowFragmentDialog(true)} disabled={!activeModel}>
            <Plus className="h-4 w-4 mr-1" /> New Fragment
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : fragments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <FileJson className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">{models.length === 0 ? 'Create a model to get started' : 'No fragments yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fragments.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.title}</span>
                    <Badge variant={f.status === 'published' ? 'default' : 'secondary'} className="text-xs">{f.status}</Badge>
                    <Badge variant="outline" className="text-xs">{f.modelName}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">/{f.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditingFragment(f)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteFragment(f.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Dialog */}
      {showModelDialog && (
        <ModelDialog
          projectId={projectId}
          onClose={() => setShowModelDialog(false)}
          onSave={() => { loadModels(); setShowModelDialog(false); }}
        />
      )}

      {/* Fragment Dialog */}
      {showFragmentDialog && activeModel && (
        <FragmentDialog
          projectId={projectId}
          modelId={activeModel}
          model={models.find((m) => m.id === activeModel)!}
          onClose={() => setShowFragmentDialog(false)}
          onSave={() => { loadFragments(); setShowFragmentDialog(false); }}
        />
      )}

      {/* Edit Fragment Dialog */}
      {editingFragment && (
        <EditFragmentDialog
          projectId={projectId}
          fragment={editingFragment}
          onClose={() => setEditingFragment(null)}
          onSave={() => { loadFragments(); setEditingFragment(null); }}
        />
      )}
    </div>
  );
}

function ModelDialog({ projectId, onClose, onSave }: { projectId: string; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaText, setSchemaText] = useState('{\n  "type": "object",\n  "properties": {\n    "headline": { "type": "string" },\n    "body": { "type": "string" },\n    "image": { "type": "string" }\n  }\n}');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const schema = JSON.parse(schemaText);
      await api.createFragmentModel(projectId, { name, description, schema });
      onSave();
    } catch { /* handle error */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Fragment Model</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Model name (e.g., product, testimonial)" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <div>
            <label className="text-xs font-medium">JSON Schema</label>
            <textarea
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[200px] mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !name}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Create Model
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FragmentDialog({ projectId, modelId, model, onClose, onSave }: {
  projectId: string; modelId: string; model: FragmentModel; onClose: () => void; onSave: () => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [dataText, setDataText] = useState('{}');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');

  const handleSave = async () => {
    if (!title || !slug) return;
    setSaving(true);
    try {
      const data = JSON.parse(dataText);
      await api.createFragment(projectId, { modelId, title, slug, data });
      onSave();
    } catch { /* handle error */ }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (!genPrompt) return;
    setGenerating(true);
    try {
      const result = await api.generateFragmentContent(projectId, modelId, genPrompt);
      setTitle(result.generated.title);
      setSlug(result.generated.slug);
      setDataText(JSON.stringify(result.generated.data, null, 2));
    } catch { /* handle error */ }
    finally { setGenerating(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New {model.name} Fragment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="AI: describe what to generate..." className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug" />
          <div>
            <label className="text-xs font-medium">Data (JSON)</label>
            <textarea
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[150px] mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || !title || !slug}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Create Fragment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditFragmentDialog({ projectId, fragment, onClose, onSave }: {
  projectId: string; fragment: ContentFragment; onClose: () => void; onSave: () => void;
}) {
  const [title, setTitle] = useState(fragment.title);
  const [dataText, setDataText] = useState(JSON.stringify(fragment.data, null, 2));
  const [status, setStatus] = useState(fragment.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = JSON.parse(dataText);
      await api.updateFragment(projectId, fragment.id, { title, data, status });
      onSave();
    } catch { /* handle error */ }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit: {fragment.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <div>
            <label className="text-xs font-medium">Data (JSON)</label>
            <textarea
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[200px] mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
