import { useState, useEffect, useCallback } from 'react';
import { api, type Workflow, type Launch, type Translation, type Notification as NotificationType } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Trash2, CheckCircle, Clock, XCircle,
  Rocket, Bell, Languages, GitBranch, PlayCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-800',
  staged: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  live: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
  review: 'bg-yellow-100 text-yellow-800',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge className={`text-xs ${statusColors[status] || ''}`}>{status}</Badge>;
}

export function EnterpriseManager() {
  const projectId = useProject((s) => s.activeProjectId);

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Select a project first</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Enterprise</h1>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="launches">Launches</TabsTrigger>
            <TabsTrigger value="translations">Translations</TabsTrigger>
            <TabsTrigger value="notifications">Inbox</TabsTrigger>
          </TabsList>
          <TabsContent value="workflows"><WorkflowsPanel projectId={projectId} /></TabsContent>
          <TabsContent value="launches"><LaunchesPanel projectId={projectId} /></TabsContent>
          <TabsContent value="translations"><TranslationsPanel projectId={projectId} /></TabsContent>
          <TabsContent value="notifications"><NotificationsPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function WorkflowsPanel({ projectId }: { projectId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'review', path: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getWorkflows(projectId); setWorkflows(data.workflows); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name) return;
    setCreating(true);
    try {
      await api.createWorkflow(projectId, {
        name: form.name,
        type: form.type,
        path: form.path || undefined,
        description: form.description || undefined,
        steps: [
          { name: 'Review content', type: 'review' },
          { name: 'Approve for publish', type: 'approval' },
        ],
      });
      setForm({ name: '', type: 'review', path: '', description: '' });
      load();
    } catch { /* handle error */ }
    finally { setCreating(false); }
  };

  const handleStatusChange = async (wf: Workflow, status: string) => {
    await api.updateWorkflow(projectId, wf.id, { status });
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Workflow name" />
        </div>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-md border px-2 py-2 text-sm">
          <option value="review">Review</option>
          <option value="publish">Publish</option>
          <option value="launch">Launch</option>
          <option value="translation">Translation</option>
        </select>
        <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="Path (optional)" className="w-40" />
        <Button size="sm" onClick={handleCreate} disabled={creating || !form.name}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Create
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : workflows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No workflows yet</p>
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <div key={wf.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{wf.name}</span>
                  <StatusBadge status={wf.status} />
                  <Badge variant="outline" className="text-xs">{wf.type}</Badge>
                </div>
                {wf.path && <p className="text-xs text-muted-foreground mt-0.5">{wf.path}</p>}
                {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
              </div>
              <div className="flex gap-1">
                {wf.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(wf, 'in_progress')}>
                    <PlayCircle className="h-3 w-3 mr-1" /> Start
                  </Button>
                )}
                {wf.status === 'in_progress' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(wf, 'approved')}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(wf, 'rejected')}>
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LaunchesPanel({ projectId }: { projectId: string }) {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', scheduledAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getLaunches(projectId); setLaunches(data.launches); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name) return;
    await api.createLaunch(projectId, {
      name: form.name,
      description: form.description || undefined,
      scheduledAt: form.scheduledAt || undefined,
    });
    setShowCreate(false);
    setForm({ name: '', description: '', scheduledAt: '' });
    load();
  };

  const handleStatusChange = async (launch: Launch, status: string) => {
    await api.updateLaunch(projectId, launch.id, { status });
    load();
  };

  const handleDelete = async (launch: Launch) => {
    await api.deleteLaunch(projectId, launch.id);
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <Button size="sm" onClick={() => setShowCreate(true)}>
        <Rocket className="h-4 w-4 mr-1" /> New Launch
      </Button>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : launches.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No launches yet</p>
      ) : (
        <div className="space-y-2">
          {launches.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{l.name}</span>
                  <StatusBadge status={l.status} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" /> {l.sourceBranch}
                  {l.scheduledAt && <><Clock className="h-3 w-3 ml-2" /> {new Date(l.scheduledAt).toLocaleDateString()}</>}
                </div>
                {l.paths.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{l.paths.length} pages</p>}
              </div>
              <div className="flex gap-1">
                {l.status === 'draft' && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(l, 'staged')}>Stage</Button>
                )}
                {l.status === 'staged' && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(l, 'live')}>Publish</Button>
                )}
                {l.status === 'draft' && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(l)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Launch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Launch name" />
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            <Button onClick={handleCreate} disabled={!form.name}>Create Launch</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TranslationsPanel({ projectId }: { projectId: string }) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ sourcePath: '', targetLocale: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getTranslations(projectId); setTranslations(data.translations); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.sourcePath || !form.targetLocale) return;
    setCreating(true);
    try {
      await api.createTranslation(projectId, { sourcePath: form.sourcePath, targetLocale: form.targetLocale });
      setForm({ sourcePath: '', targetLocale: '' });
      load();
    } catch { /* handle error */ }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2 items-end">
        <Input value={form.sourcePath} onChange={(e) => setForm({ ...form, sourcePath: e.target.value })} placeholder="Source path (e.g., /en/about)" className="flex-1" />
        <select value={form.targetLocale} onChange={(e) => setForm({ ...form, targetLocale: e.target.value })} className="rounded-md border px-2 py-2 text-sm">
          <option value="">Target language</option>
          <option value="de">German (de)</option>
          <option value="fr">French (fr)</option>
          <option value="es">Spanish (es)</option>
          <option value="it">Italian (it)</option>
          <option value="ja">Japanese (ja)</option>
          <option value="ko">Korean (ko)</option>
          <option value="pt">Portuguese (pt)</option>
          <option value="zh">Chinese (zh)</option>
        </select>
        <Button size="sm" onClick={handleCreate} disabled={creating || !form.sourcePath || !form.targetLocale}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4 mr-1" />}
          Translate
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : translations.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No translations yet</p>
      ) : (
        <div className="space-y-2">
          {translations.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.sourcePath}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm">{t.targetPath}</span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.sourceLocale} → {t.targetLocale} ({t.provider || 'ai'})
                </p>
              </div>
              {t.status === 'review' && (
                <Button variant="outline" size="sm" onClick={async () => {
                  await api.updateTranslation(projectId, t.id, 'completed');
                  load();
                }}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Approve
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getNotifications(); setNotifications(data.notifications); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    load();
  };

  const handleMarkAll = async () => {
    await api.markAllNotificationsRead();
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {notifications.filter((n) => !n.read).length} unread
        </span>
        <Button variant="ghost" size="sm" onClick={handleMarkAll}>Mark all read</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Bell className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && handleMarkRead(n.id)}
              className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${n.read ? 'opacity-60' : 'bg-muted/50 hover:bg-muted'}`}
            >
              <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
