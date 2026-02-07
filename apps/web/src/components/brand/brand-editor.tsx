import { useState, useEffect, useCallback } from 'react';
import { api, type BrandProfile, type VoiceValidation, type BrandAudit } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Save, Plus, Trash2, Sparkles, CheckCircle, AlertTriangle, X, ShieldCheck,
} from 'lucide-react';

export function BrandEditor() {
  const projectId = useProject((s) => s.activeProjectId);
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [tone, setTone] = useState('');
  const [personality, setPersonality] = useState('');
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [contentRules, setContentRules] = useState<Record<string, unknown>>({});
  const [rulesText, setRulesText] = useState('');

  // Visual
  const [colors, setColors] = useState<Record<string, string>>({});
  const [typography, setTypography] = useState<Record<string, string>>({});

  // Validation
  const [validationText, setValidationText] = useState('');
  const [validating, setValidating] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceValidation | null>(null);

  // Audit
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<BrandAudit | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getBrandProfiles(projectId);
      setProfiles(data.profiles);
      const profile = data.profiles.find((p) => p.name === activeProfile) || data.profiles[0];
      if (profile) applyProfile(profile);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId, activeProfile]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const applyProfile = (profile: BrandProfile) => {
    setActiveProfile(profile.name);
    setTone(profile.voice?.tone || '');
    setPersonality(profile.voice?.personality || '');
    setDos(profile.voice?.dos || []);
    setDonts(profile.voice?.donts || []);
    setContentRules(profile.contentRules || {});
    setRulesText(JSON.stringify(profile.contentRules || {}, null, 2));
    setColors(profile.visual?.colors || {});
    setTypography(profile.visual?.typography || {});
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      let parsedRules = contentRules;
      try { parsedRules = JSON.parse(rulesText); } catch { /* keep existing */ }

      await api.saveBrandProfile(projectId, activeProfile, {
        voice: { tone, personality, dos, donts },
        visual: { colors, typography },
        contentRules: parsedRules,
      });
      await loadProfiles();
    } catch { /* handle error */ }
    finally { setSaving(false); }
  };

  const handleValidateVoice = async () => {
    if (!projectId || !validationText) return;
    setValidating(true);
    setVoiceResult(null);
    try {
      const data = await api.validateVoice(projectId, validationText, activeProfile);
      setVoiceResult(data.validation);
    } catch { /* handle error */ }
    finally { setValidating(false); }
  };

  const handleAudit = async () => {
    if (!projectId) return;
    setAuditing(true);
    setAuditResult(null);
    try {
      const data = await api.runBrandAudit(projectId, activeProfile);
      setAuditResult(data.audit);
    } catch { /* handle error */ }
    finally { setAuditing(false); }
  };

  const handleNewProfile = async () => {
    const name = prompt('Profile name:');
    if (!name || !projectId) return;
    await api.saveBrandProfile(projectId, name, {
      voice: { tone: '', personality: '', dos: [], donts: [] },
      visual: {},
      contentRules: {},
    });
    setActiveProfile(name);
    loadProfiles();
  };

  const handleDeleteProfile = async (name: string) => {
    if (!projectId || name === 'default') return;
    await api.deleteBrandProfile(projectId, name);
    setActiveProfile('default');
    loadProfiles();
  };

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Select a project first</div>;
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Brand Identity</h1>
        <div className="flex gap-1 ml-4">
          {profiles.map((p) => (
            <Button
              key={p.name}
              variant={activeProfile === p.name ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => applyProfile(p)}
            >
              {p.name}
              {p.name !== 'default' && activeProfile === p.name && (
                <button className="ml-1" onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.name); }}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={handleNewProfile}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAudit} disabled={auditing}>
            {auditing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Audit
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="voice">
          <TabsList>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="rules">Content Rules</TabsTrigger>
            <TabsTrigger value="validate">Validate</TabsTrigger>
            {auditResult && <TabsTrigger value="audit">Audit Results</TabsTrigger>}
          </TabsList>

          {/* Voice Tab */}
          <TabsContent value="voice" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tone</label>
                <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g., professional, warm, authoritative" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Personality</label>
                <Input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="e.g., knowledgeable guide, trusted advisor" className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Do's</label>
              <ListEditor items={dos} onChange={setDos} placeholder="Add a do..." />
            </div>

            <div>
              <label className="text-sm font-medium">Don'ts</label>
              <ListEditor items={donts} onChange={setDonts} placeholder="Add a don't..." />
            </div>
          </TabsContent>

          {/* Visual Tab */}
          <TabsContent value="visual" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Brand Colors</label>
              <KeyValueEditor entries={colors} onChange={setColors} keyPlaceholder="e.g., primary" valuePlaceholder="e.g., #1a73e8" />
            </div>
            <div>
              <label className="text-sm font-medium">Typography</label>
              <KeyValueEditor entries={typography} onChange={setTypography} keyPlaceholder="e.g., heading" valuePlaceholder="e.g., Inter, 700" />
            </div>
          </TabsContent>

          {/* Content Rules Tab */}
          <TabsContent value="rules" className="mt-4">
            <label className="text-sm font-medium">Content Rules (JSON)</label>
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[200px]"
              placeholder='{"maxHeadingLength": 60, "requiredSections": ["intro", "cta"]}'
            />
          </TabsContent>

          {/* Validate Tab */}
          <TabsContent value="validate" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Test text against brand voice</label>
              <textarea
                value={validationText}
                onChange={(e) => setValidationText(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[120px]"
                placeholder="Paste content to validate..."
              />
              <Button size="sm" className="mt-2" onClick={handleValidateVoice} disabled={validating || !validationText}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Validate
              </Button>
            </div>
            {voiceResult && <VoiceResultCard result={voiceResult} />}
          </TabsContent>

          {/* Audit Tab */}
          {auditResult && (
            <TabsContent value="audit" className="space-y-4 mt-4">
              <AuditResultCard audit={auditResult} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) {
      onChange([...items, v]);
      setInput('');
    }
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1">
            {item}
            <button onClick={() => onChange(items.filter((i) => i !== item))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={placeholder} className="flex-1" />
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function KeyValueEditor({ entries, onChange, keyPlaceholder, valuePlaceholder }: {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const add = () => {
    if (newKey.trim()) {
      onChange({ ...entries, [newKey.trim()]: newValue.trim() });
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <div className="mt-1 space-y-2">
      {Object.entries(entries).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="text-sm font-medium w-32 truncate">{k}</span>
          <Input
            value={v}
            onChange={(e) => onChange({ ...entries, [k]: e.target.value })}
            className="flex-1"
          />
          {k.startsWith('#') || v.startsWith('#') ? (
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: v }} />
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => {
            const next = { ...entries };
            delete next[k];
            onChange(next);
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={keyPlaceholder} className="w-32" />
        <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={valuePlaceholder} className="flex-1" />
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function VoiceResultCard({ result }: { result: VoiceValidation }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`text-2xl font-bold ${result.score >= 70 ? 'text-green-600' : result.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {result.score}/100
        </div>
        <span className="text-sm text-muted-foreground">Voice Compliance Score</span>
      </div>

      {result.strengths.length > 0 && (
        <div>
          <h4 className="text-sm font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-600" /> Strengths</h4>
          <ul className="text-sm text-muted-foreground mt-1 space-y-1">
            {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {result.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-yellow-600" /> Issues</h4>
          <div className="space-y-2 mt-1">
            {result.issues.map((issue, i) => (
              <div key={i} className="text-sm rounded bg-muted p-2">
                <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs mb-1">{issue.severity}</Badge>
                <p>{issue.description}</p>
                {issue.suggestion && <p className="text-muted-foreground mt-1">Suggestion: {issue.suggestion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.rewriteSuggestion && (
        <div>
          <h4 className="text-sm font-medium">Suggested Rewrite</h4>
          <p className="text-sm text-muted-foreground mt-1 italic">{result.rewriteSuggestion}</p>
        </div>
      )}
    </div>
  );
}

function AuditResultCard({ audit }: { audit: BrandAudit }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`text-3xl font-bold ${audit.overallScore >= 70 ? 'text-green-600' : audit.overallScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {audit.overallScore}/100
        </div>
        <p className="text-sm text-muted-foreground">{audit.summary}</p>
      </div>

      {audit.recommendations.length > 0 && (
        <div className="rounded-lg border p-3">
          <h4 className="text-sm font-medium mb-2">Top Recommendations</h4>
          <ul className="text-sm space-y-1">
            {audit.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">{i + 1}.</span> {r}</li>)}
          </ul>
        </div>
      )}

      {audit.trends.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Common Trends</h4>
          <div className="flex flex-wrap gap-1">
            {audit.trends.map((t, i) => <Badge key={i} variant="outline">{t}</Badge>)}
          </div>
        </div>
      )}

      {audit.pages.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Page Scores</h4>
          <div className="space-y-2">
            {audit.pages.map((page) => (
              <div key={page.path} className="rounded border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{page.path}</span>
                  <Badge variant={page.score >= 70 ? 'secondary' : 'destructive'}>{page.score}/100</Badge>
                </div>
                {page.issues.length > 0 && (
                  <ul className="text-muted-foreground mt-1 text-xs space-y-0.5">
                    {page.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
