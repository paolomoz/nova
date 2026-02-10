import { useState, useEffect, useCallback } from 'react';
import { api, type SeoMetadata, type SeoAnalysis } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Search, Sparkles, ExternalLink, AlertTriangle, CheckCircle, Code,
} from 'lucide-react';

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return <Badge variant="outline" className="text-xs">{label}: -</Badge>;
  const color = score >= 70 ? 'bg-green-100 text-green-800' : score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <Badge className={`text-xs ${color}`}>{label}: {score}</Badge>;
}

export function SeoDashboard() {
  const projectId = useProject((s) => s.activeProjectId);
  const [pages, setPages] = useState<SeoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<SeoMetadata | null>(null);

  const loadPages = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try { const data = await api.getSeoPages(projectId); setPages(data.pages); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const handleAnalyze = async (path: string) => {
    if (!projectId) return;
    setSelectedPath(path);
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const data = await api.analyzeSeo(projectId, path);
      setAnalysis(data.analysis);
      loadPages();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setAnalysisError(message);
    } finally { setAnalyzing(false); }
  };

  const handleSaveMeta = async () => {
    if (!projectId || !editingMeta) return;
    await api.updatePageSeo(projectId, {
      path: editingMeta.path,
      title: editingMeta.title || undefined,
      description: editingMeta.description || undefined,
      keywords: editingMeta.keywords,
      robots: editingMeta.robots,
    });
    setEditingMeta(null);
    loadPages();
  };

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Select a project first</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-lg font-semibold">SEO & LLM Optimization</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analyze">Analyze Page</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : pages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No SEO data yet. Analyze a page to get started.</p>
            ) : (
              <div className="space-y-2">
                {pages.map((page) => (
                  <div key={page.path} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{page.path}</p>
                      {page.title && <p className="text-xs text-muted-foreground truncate">{page.title}</p>}
                    </div>
                    <ScoreBadge score={page.seoScore} label="SEO" />
                    <ScoreBadge score={page.llmCitabilityScore} label="LLM" />
                    <Button variant="outline" size="sm" onClick={() => handleAnalyze(page.path)}>
                      <Sparkles className="h-3 w-3 mr-1" /> Analyze
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingMeta(page)}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analyze" className="mt-4">
            <AnalyzeForm projectId={projectId} onAnalyze={handleAnalyze} analyzing={analyzing} analysis={analysis} error={analysisError} />
          </TabsContent>
        </Tabs>

        {/* Analysis results */}
        {analysis && selectedPath && (
          <AnalysisResults path={selectedPath} analysis={analysis} projectId={projectId} />
        )}
      </div>

      {/* Edit meta dialog */}
      {editingMeta && (
        <Dialog open onOpenChange={() => setEditingMeta(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit SEO: {editingMeta.path}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Title</label>
                <Input value={editingMeta.title || ''} onChange={(e) => setEditingMeta({ ...editingMeta, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <textarea
                  value={editingMeta.description || ''}
                  onChange={(e) => setEditingMeta({ ...editingMeta, description: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Keywords (comma-separated)</label>
                <Input
                  value={editingMeta.keywords.join(', ')}
                  onChange={(e) => setEditingMeta({ ...editingMeta, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Robots</label>
                <Input value={editingMeta.robots} onChange={(e) => setEditingMeta({ ...editingMeta, robots: e.target.value })} />
              </div>
              <Button onClick={handleSaveMeta}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AnalyzeForm({ projectId, onAnalyze, analyzing, analysis, error }: {
  projectId: string;
  onAnalyze: (path: string) => void;
  analyzing: boolean;
  analysis: SeoAnalysis | null;
  error: string | null;
}) {
  const [path, setPath] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && path && !analyzing) onAnalyze(path); }}
          placeholder="/en/about"
          className="flex-1"
        />
        <Button onClick={() => onAnalyze(path)} disabled={analyzing || !path}>
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Analyze
        </Button>
      </div>
      {analyzing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing page — this may take a moment…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function AnalysisResults({ path, analysis, projectId }: { path: string; analysis: SeoAnalysis; projectId: string }) {
  const [generating, setGenerating] = useState(false);

  const handleApplySuggestions = async () => {
    await api.updatePageSeo(projectId, {
      path,
      title: analysis.suggestedTitle,
      description: analysis.suggestedDescription,
      keywords: analysis.suggestedKeywords,
      structuredData: analysis.structuredData,
    });
  };

  const handleGenerateJsonLd = async () => {
    setGenerating(true);
    try {
      await api.generateStructuredData(projectId, path);
    } catch { /* handle error */ }
    finally { setGenerating(false); }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-4">
        <h3 className="font-medium">Analysis: {path}</h3>
        <ScoreBadge score={analysis.seoScore} label="SEO" />
        <ScoreBadge score={analysis.llmCitabilityScore} label="LLM Citability" />
      </div>

      {/* Suggestions */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="text-sm font-medium">Suggestions</h4>
        <div className="text-sm space-y-1">
          <p><strong>Title:</strong> {analysis.suggestedTitle}</p>
          <p><strong>Description:</strong> {analysis.suggestedDescription}</p>
          <div className="flex gap-1 flex-wrap">
            <strong className="text-sm">Keywords:</strong>
            {analysis.suggestedKeywords.map((k) => <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>)}
          </div>
        </div>
        <Button size="sm" onClick={handleApplySuggestions}>Apply Suggestions</Button>
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" /> SEO Issues
          </h4>
          {analysis.issues.map((issue, i) => (
            <div key={i} className="rounded border p-2 text-sm">
              <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs mb-1">{issue.severity}</Badge>
              <p>{issue.description}</p>
              <p className="text-muted-foreground mt-0.5">Fix: {issue.fix}</p>
            </div>
          ))}
        </div>
      )}

      {/* LLM Issues */}
      {analysis.llmIssues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">LLM Citability Issues</h4>
          {analysis.llmIssues.map((issue, i) => (
            <div key={i} className="rounded border p-2 text-sm">
              <p>{issue.description}</p>
              <p className="text-muted-foreground mt-0.5">Fix: {issue.fix}</p>
            </div>
          ))}
        </div>
      )}

      {/* Internal Links */}
      {analysis.internalLinks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <ExternalLink className="h-4 w-4" /> Suggested Internal Links
          </h4>
          {analysis.internalLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">{link.targetPath}</Badge>
              <span>"{link.anchorText}"</span>
              <span className="text-xs text-muted-foreground">— {link.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Structured Data */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium flex items-center gap-1"><Code className="h-4 w-4" /> JSON-LD</h4>
          <Button variant="outline" size="sm" onClick={handleGenerateJsonLd} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Regenerate
          </Button>
        </div>
        <pre className="rounded border bg-muted p-3 text-xs overflow-x-auto max-h-48">
          {JSON.stringify(analysis.structuredData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
