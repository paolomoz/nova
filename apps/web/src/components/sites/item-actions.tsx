import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ListItem } from '@/lib/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, Copy, Move, Pencil, Trash2, Info, Loader2, FileEdit } from 'lucide-react';

interface ItemActionsProps {
  item: ListItem;
  projectId: string;
  onRefresh: () => void;
  onSelectForProperties: (path: string) => void;
}

type DialogType = 'rename' | 'copy' | 'move' | 'delete' | null;

export function ItemActions({ item, projectId, onRefresh, onSelectForProperties }: ItemActionsProps) {
  const navigate = useNavigate();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isFolder = !item.ext;

  const openDialog = (type: DialogType) => {
    setError('');
    setLoading(false);
    if (type === 'rename') {
      setInputValue(item.name);
    } else if (type === 'copy' || type === 'move') {
      setInputValue(item.path);
    }
    setActiveDialog(type);
  };

  const handleRename = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    try {
      const parentDir = item.path.split('/').slice(0, -1).join('/');
      const newPath = `${parentDir}/${inputValue.trim()}`;
      await api.movePage(projectId, item.path, newPath);
      setActiveDialog(null);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    try {
      await api.copyPage(projectId, item.path, inputValue.trim());
      setActiveDialog(null);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    try {
      await api.movePage(projectId, item.path, inputValue.trim());
      setActiveDialog(null);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.deletePage(projectId, item.path);
      setActiveDialog(null);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isFolder && (
            <DropdownMenuItem onClick={() => navigate(`/editor?path=${encodeURIComponent(item.path)}`)}>
              <FileEdit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {!isFolder && (
            <DropdownMenuItem onClick={() => onSelectForProperties(item.path)}>
              <Info className="mr-2 h-4 w-4" />
              Properties
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openDialog('rename')}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog('copy')}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog('move')}>
            <Move className="mr-2 h-4 w-4" />
            Move
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openDialog('delete')} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={activeDialog === 'rename'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleRename} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={activeDialog === 'copy'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Copy to</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Destination path</label>
              <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="mt-1" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(); }} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleCopy} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={activeDialog === 'move'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Move to</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Destination path</label>
              <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="mt-1" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleMove(); }} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button onClick={handleMove} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Move
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={activeDialog === 'delete'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete {isFolder ? 'folder' : 'page'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{item.name}</strong> at <code className="text-xs">{item.path}</code>? This action cannot be undone.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
