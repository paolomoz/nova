import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText, Folder, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ListItem {
  name: string;
  path: string;
  ext?: string;
  lastModified?: string;
}

export function SitesPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(true);

  // Load projects
  useEffect(() => {
    api.getProjects().then((data) => {
      setProjects(data.projects);
      if (data.projects.length > 0) {
        setProjectId(data.projects[0].id);
      }
      setLoading(false);
    });
  }, []);

  // Load pages when project or path changes
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.listPages(projectId, currentPath).then((data) => {
      setItems(data.items);
      setLoading(false);
    }).catch(() => {
      setItems([]);
      setLoading(false);
    });
  }, [projectId, currentPath]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  if (loading && !projects.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">No projects yet</h2>
        <p className="text-muted-foreground">Create a project to get started.</p>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Sites Console</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {currentPath.split('/').filter(Boolean).map((segment, i, arr) => {
              const path = '/' + arr.slice(0, i + 1).join('/');
              return (
                <span key={path}>
                  <button
                    className="hover:text-foreground"
                    onClick={() => navigateTo(path)}
                  >
                    {segment}
                  </button>
                  {i < arr.length - 1 && <span className="mx-1">/</span>}
                </span>
              );
            })}
            {currentPath === '/' && <span>/</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            ⌘K to open AI command bar
          </span>
        </div>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {currentPath !== '/' && (
          <button
            className="mb-2 flex w-full items-center gap-3 rounded-lg p-3 text-sm hover:bg-muted"
            onClick={() => {
              const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
              navigateTo(parent);
            }}
          >
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span>..</span>
          </button>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Empty directory</p>
        ) : (
          items.map((item) => {
            const isFolder = !item.ext;
            return (
              <button
                key={item.path}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-sm hover:bg-muted"
                onClick={() => {
                  if (isFolder) navigateTo(item.path);
                }}
              >
                {isFolder ? (
                  <Folder className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="flex-1 text-left">{item.name}</span>
                {item.lastModified && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.lastModified).toLocaleDateString()}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
