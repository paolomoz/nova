import { useState, useEffect, useRef } from 'react';
import { api, type AssetDetail } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Upload, Image, FileText, Loader2, GripVertical } from 'lucide-react';

interface AssetBrowserProps {
  projectId: string;
  onInsertImage: (url: string, alt: string) => void;
}

export function AssetBrowser({ projectId, onInsertImage }: AssetBrowserProps) {
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/media');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    api.listAssets(projectId, currentPath).then((data) => {
      setAssets(data.assets);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId, currentPath]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadPath = `${currentPath}/${file.name}`;
      await api.uploadAsset(projectId, uploadPath, file);
      // Refresh
      const data = await api.listAssets(projectId, currentPath);
      setAssets(data.assets);
    } catch {
      // Handle error
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = filter
    ? assets.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()))
    : assets;

  const getExt = (name: string) => (name.split('.').pop() || '').toLowerCase();
  const isImage = (name: string) => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(getExt(name));

  const handleDragStart = (e: React.DragEvent, asset: AssetDetail) => {
    e.dataTransfer.setData('text/plain', asset.path);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Assets</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
            Upload
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf"
          className="hidden"
          onChange={handleUpload}
        />
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search assets..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {filter ? 'No assets match your search.' : 'No assets found. Upload one to get started.'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {filtered.map((asset) => (
              <button
                key={asset.path}
                className="group flex flex-col items-center rounded-lg border p-2 text-center hover:bg-muted transition-colors"
                onClick={() => {
                  if (isImage(asset.name)) {
                    onInsertImage(asset.path, asset.name.replace(/\.[^.]+$/, ''));
                  }
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
              >
                {isImage(asset.name) ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded bg-muted">
                    <Image className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground/30" />
                    {/* In production, this would show a thumbnail */}
                    <GripVertical className="absolute top-1 left-1 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <span className="mt-1 w-full truncate text-[0.65rem] text-muted-foreground">{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
