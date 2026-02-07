import { useState, useEffect } from 'react';
import { api, type PageTemplate } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Loader2 } from 'lucide-react';

interface CreatePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentPath: string;
  onCreated: () => void;
}

export function CreatePageDialog({ open, onOpenChange, projectId, currentPath, onCreated }: CreatePageDialogProps) {
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [pageName, setPageName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      api.getTemplates(projectId).then((d) => setTemplates(d.templates));
      setPageName('');
      setError('');
      setSelectedTemplate('blank');
    }
  }, [open, projectId]);

  const handleCreate = async () => {
    if (!pageName.trim()) {
      setError('Page name is required');
      return;
    }

    const slug = pageName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!slug) {
      setError('Invalid page name');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const template = templates.find((t) => t.id === selectedTemplate);
      const html = template?.html || '<h1>New Page</h1>';
      const path = `${currentPath === '/' ? '' : currentPath}/${slug}`;
      await api.createPage(projectId, path, html);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Page</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Page Name</label>
            <Input
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="e.g. About Us"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            {pageName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Path: {currentPath === '/' ? '' : currentPath}/{pageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Template</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted ${
                    selectedTemplate === template.id ? 'border-primary bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{template.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
