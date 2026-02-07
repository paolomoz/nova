import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type AssetDetail } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Upload, Search, Trash2, Loader2, Image, FileText, Film,
  Music, X, Sparkles, Tag, Grid3X3, List,
} from 'lucide-react';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.startsWith('video/')) return Film;
  if (mimeType?.startsWith('audio/')) return Music;
  return FileText;
}

export function AssetManager() {
  const projectId = useProject((s) => s.activeProjectId);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<AssetDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genResult, setGenResult] = useState<{ refinedPrompt: string; suggestedAltText: string; suggestedTags: string[]; suggestedFileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.listAssets(projectId, '/', search || undefined);
      setAssets(data.assets);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [projectId, search]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!projectId || !e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await api.uploadAsset(projectId, '/media', file);
      }
      await loadAssets();
    } catch { /* handle error */ }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (asset: AssetDetail) => {
    if (!projectId) return;
    await api.deleteAsset(projectId, asset.id);
    setSelected(null);
    loadAssets();
  };

  const handleUpdateMetadata = async (asset: AssetDetail, altText: string, tags: string[]) => {
    if (!projectId) return;
    await api.updateAsset(projectId, asset.id, { altText, tags });
    loadAssets();
    setSelected(null);
  };

  const handleGenerate = async () => {
    if (!projectId || !genPrompt) return;
    setGenerating(true);
    try {
      const data = await api.generateImage(projectId, genPrompt);
      setGenResult(data.generation);
    } catch { /* handle error */ }
    finally { setGenerating(false); }
  };

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Select a project first</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Assets</h1>
        <div className="flex flex-1 items-center gap-2 ml-4">
          <Input
            placeholder="Search assets..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 border rounded-md">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4" />
          </Button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          Upload
        </Button>
        <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
          <Sparkles className="h-4 w-4 mr-1" />
          Generate
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mb-3 opacity-40" />
            <p>{search ? 'No assets match your search' : 'No assets yet'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => fileInputRef.current?.click()}>
              Upload your first asset
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} projectId={projectId} onClick={() => setSelected(asset)} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} projectId={projectId} onClick={() => setSelected(asset)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      {selected && (
        <AssetDetailDialog
          asset={selected}
          projectId={projectId}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onSave={handleUpdateMetadata}
        />
      )}

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={(open) => { setGenOpen(open); if (!open) { setGenPrompt(''); setGenResult(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>AI Image Generation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Describe the image you want..."
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
            />
            <Button onClick={handleGenerate} disabled={generating || !genPrompt}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate
            </Button>
            {genResult && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p><strong>Refined prompt:</strong> {genResult.refinedPrompt}</p>
                <p><strong>Alt text:</strong> {genResult.suggestedAltText}</p>
                <p><strong>File name:</strong> {genResult.suggestedFileName}</p>
                <div className="flex gap-1 flex-wrap">
                  {genResult.suggestedTags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetCard({ asset, projectId, onClick }: { asset: AssetDetail; projectId: string; onClick: () => void }) {
  const Icon = mimeIcon(asset.mimeType);
  const isImage = asset.mimeType?.startsWith('image/');

  return (
    <button onClick={onClick} className="group flex flex-col rounded-lg border bg-card text-left hover:border-primary/50 transition-colors overflow-hidden">
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={api.getAssetUrl(projectId, asset.path)} alt={asset.altText} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium truncate">{asset.name}</p>
        <p className="text-xs text-muted-foreground">{formatSize(asset.size)}</p>
      </div>
    </button>
  );
}

function AssetRow({ asset, projectId, onClick }: { asset: AssetDetail; projectId: string; onClick: () => void }) {
  const Icon = mimeIcon(asset.mimeType);
  const isImage = asset.mimeType?.startsWith('image/');

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors">
      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {isImage ? (
          <img src={api.getAssetUrl(projectId, asset.path)} alt={asset.altText} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Icon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.name}</p>
        <p className="text-xs text-muted-foreground">{asset.path}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {asset.tags.length > 0 && <Badge variant="secondary" className="text-xs">{asset.tags.length} tags</Badge>}
        <span>{formatSize(asset.size)}</span>
      </div>
    </button>
  );
}

function AssetDetailDialog({
  asset, projectId, onClose, onDelete, onSave,
}: {
  asset: AssetDetail;
  projectId: string;
  onClose: () => void;
  onDelete: (asset: AssetDetail) => void;
  onSave: (asset: AssetDetail, altText: string, tags: string[]) => void;
}) {
  const [altText, setAltText] = useState(asset.altText || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(asset.tags || []);
  const isImage = asset.mimeType?.startsWith('image/');

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{asset.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {/* Preview */}
          <div className="rounded-lg border bg-muted flex items-center justify-center overflow-hidden aspect-square">
            {isImage ? (
              <img src={api.getAssetUrl(projectId, asset.path)} alt={altText} className="max-h-full max-w-full object-contain" />
            ) : (
              <FileText className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Path</label>
              <p className="text-sm">{asset.path}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type / Size</label>
              <p className="text-sm">{asset.mimeType} — {formatSize(asset.size)}</p>
            </div>
            {asset.width && asset.height && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dimensions</label>
                <p className="text-sm">{asset.width} x {asset.height}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Alt Text</label>
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe this asset..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Add tag..." className="flex-1" />
                <Button variant="outline" size="sm" onClick={addTag}><Tag className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => onSave(asset, altText, tags)}>Save</Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(asset)}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
