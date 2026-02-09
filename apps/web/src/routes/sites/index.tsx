import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ListItem } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CreatePageDialog } from '@/components/sites/create-page-dialog';
import { ItemActions } from '@/components/sites/item-actions';
import { PropertiesPanel } from '@/components/sites/properties-panel';
import { SearchBar } from '@/components/sites/search-bar';
import {
  FileText, Folder, Plus, ChevronRight, List, LayoutGrid, FolderTree,
  ArrowUpDown, RefreshCw, FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'column' | 'tree';
type SortField = 'name' | 'lastModified';
type SortOrder = 'asc' | 'desc';

export function SitesPage() {
  const navigate = useNavigate();
  // Project state (shared store)
  const { projects, activeProjectId: projectId, loading: projectsLoading, loadProjects, setActiveProject } = useProject();

  // Navigation
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Column view state (multiple columns)
  const [columnPaths, setColumnPaths] = useState<string[]>(['/']);
  const [columnItems, setColumnItems] = useState<Record<string, ListItem[]>>({});

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [propertiesPath, setPropertiesPath] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Tree state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [treeItems, setTreeItems] = useState<Record<string, ListItem[]>>({ '/': [] });

  // Load projects
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load items for current path (list view)
  const loadItems = useCallback(async (path: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.listPages(projectId, path);
      setItems(data.items);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (viewMode === 'list') loadItems(currentPath);
  }, [currentPath, projectId, viewMode, loadItems]);

  // Column view: load items for a column
  const loadColumnItems = useCallback(async (path: string) => {
    if (!projectId) return;
    try {
      const data = await api.listPages(projectId, path);
      setColumnItems((prev) => ({ ...prev, [path]: data.items }));
    } catch {
      setColumnItems((prev) => ({ ...prev, [path]: [] }));
    }
  }, [projectId]);

  useEffect(() => {
    if (viewMode === 'column') {
      for (const p of columnPaths) {
        if (!columnItems[p]) loadColumnItems(p);
      }
    }
  }, [viewMode, columnPaths, columnItems, loadColumnItems]);

  // Tree view: load children
  const loadTreeChildren = useCallback(async (path: string) => {
    if (!projectId) return;
    try {
      const data = await api.listPages(projectId, path);
      setTreeItems((prev) => ({ ...prev, [path]: data.items }));
    } catch {
      setTreeItems((prev) => ({ ...prev, [path]: [] }));
    }
  }, [projectId]);

  useEffect(() => {
    if (viewMode === 'tree') {
      for (const path of expandedFolders) {
        if (!treeItems[path]) loadTreeChildren(path);
      }
    }
  }, [viewMode, expandedFolders, treeItems, loadTreeChildren]);

  // Sorting
  const sortItems = (items: ListItem[]) => {
    return [...items].sort((a, b) => {
      // Folders first
      const aIsFolder = !a.ext;
      const bIsFolder = !b.ext;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'lastModified') {
        cmp = (a.lastModified || '').localeCompare(b.lastModified || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  };

  const openInEditor = (path: string) => {
    navigate(`/editor?path=${encodeURIComponent(path)}`);
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedItems(new Set());
  };

  const handleColumnNavigate = (path: string, columnIndex: number) => {
    // Trim columns to the right and add new one
    const newPaths = columnPaths.slice(0, columnIndex + 1);
    newPaths.push(path);
    setColumnPaths(newPaths);
    setCurrentPath(path);
  };

  const handleRefresh = () => {
    if (viewMode === 'list') loadItems(currentPath);
    else if (viewMode === 'column') {
      setColumnItems({});
      for (const p of columnPaths) loadColumnItems(p);
    } else {
      setTreeItems({});
      for (const p of expandedFolders) loadTreeChildren(p);
    }
  };

  const toggleSort = () => {
    if (sortField === 'name' && sortOrder === 'asc') {
      setSortOrder('desc');
    } else if (sortField === 'name') {
      setSortField('lastModified');
      setSortOrder('desc');
    } else {
      setSortField('name');
      setSortOrder('asc');
    }
  };

  const toggleTreeFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Breadcrumb
  const breadcrumbs = currentPath === '/'
    ? [{ label: '/', path: '/' }]
    : [{ label: '/', path: '/' }, ...currentPath.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: seg,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))];

  if (!projects.length && !projectsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">No projects yet</h2>
        <p className="text-muted-foreground">Create a project to get started.</p>
        <Button onClick={async () => {
          try {
            await api.createProject({ name: 'My Project', slug: 'my-project', daOrg: 'my-org', daRepo: 'my-repo' });
            loadProjects();
          } catch { /* non-fatal */ }
        }}><Plus className="mr-2 h-4 w-4" />Create Project</Button>
      </div>
    );
  }

  // Tree node renderer
  const renderTreeNode = (items: ListItem[], depth: number): React.ReactNode => {
    return sortItems(items).map((item) => {
      const isFolder = !item.ext;
      const isExpanded = expandedFolders.has(item.path);
      const children = treeItems[item.path];
      return (
        <div key={item.path}>
          <div
            className={cn(
              'flex items-center gap-1 rounded-sm py-1 pr-2 text-sm hover:bg-muted cursor-pointer',
              selectedItems.has(item.path) && 'bg-accent',
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (isFolder) {
                toggleTreeFolder(item.path);
                setCurrentPath(item.path);
              }
              setSelectedItems(new Set([item.path]));
            }}
            onDoubleClick={() => {
              if (!isFolder) openInEditor(item.path);
            }}
          >
            {isFolder ? (
              <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
            ) : (
              <span className="w-3.5" />
            )}
            {isFolder ? (
              isExpanded ? <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{item.name}</span>
            <ItemActions item={item} projectId={projectId!} onRefresh={handleRefresh} onSelectForProperties={setPropertiesPath} />
          </div>
          {isFolder && isExpanded && children && renderTreeNode(children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Project selector */}
            {projects.length > 1 && (
              <Select value={projectId || ''} onValueChange={(v) => { setActiveProject(v); setCurrentPath('/'); }}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {projects.length === 1 && (
              <span className="text-sm font-medium">{projects[0].name}</span>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((bc, i) => (
                <span key={bc.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <button
                    className={cn('hover:text-foreground', i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground')}
                    onClick={() => navigateTo(bc.path)}
                  >
                    {bc.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {projectId && <SearchBar projectId={projectId} onNavigate={navigateTo} />}

            <Separator orientation="vertical" className="h-6" />

            {/* View mode toggle */}
            <div className="flex rounded-md border">
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-r-none" onClick={() => setViewMode('list')} title="List view">
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'column' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none border-x" onClick={() => { setViewMode('column'); setColumnPaths(['/']); setColumnItems({}); }} title="Column view">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'tree' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-l-none" onClick={() => { setViewMode('tree'); setExpandedFolders(new Set(['/'])); setTreeItems({}); }} title="Tree view">
                <FolderTree className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSort} title={`Sort by ${sortField} ${sortOrder}`}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New Page
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="p-4">
              {/* Column headers */}
              <div className="flex items-center gap-3 border-b px-3 pb-2 text-xs font-medium text-muted-foreground">
                <span className="w-5" />
                <span className="flex-1">Name</span>
                <span className="w-32 text-right">Modified</span>
                <span className="w-8" />
              </div>

              {/* Parent directory */}
              {currentPath !== '/' && (
                <button
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => navigateTo(currentPath.split('/').slice(0, -1).join('/') || '/')}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-muted-foreground">..</span>
                </button>
              )}

              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              ) : items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Empty directory. Create a page to get started.</p>
              ) : (
                sortItems(items).map((item) => {
                  const isFolder = !item.ext;
                  const isSelected = selectedItems.has(item.path);
                  return (
                    <div
                      key={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer',
                        isSelected && 'bg-accent',
                      )}
                      onClick={() => {
                        if (isFolder) navigateTo(item.path);
                        setSelectedItems(new Set([item.path]));
                      }}
                      onDoubleClick={() => {
                        if (!isFolder) openInEditor(item.path);
                      }}
                    >
                      {isFolder ? (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1">{item.name}</span>
                      <span className="w-32 text-right text-xs text-muted-foreground">
                        {item.lastModified ? new Date(item.lastModified).toLocaleDateString() : ''}
                      </span>
                      <ItemActions item={item} projectId={projectId!} onRefresh={handleRefresh} onSelectForProperties={setPropertiesPath} />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* COLUMN VIEW */}
          {viewMode === 'column' && (
            <div className="flex h-full">
              {columnPaths.map((colPath, colIdx) => {
                const colItems = columnItems[colPath] || [];
                return (
                  <div key={colPath} className="flex h-full w-64 shrink-0 flex-col border-r">
                    <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground truncate">
                      {colPath === '/' ? '/' : colPath.split('/').pop()}
                    </div>
                    <div className="flex-1 overflow-auto">
                      {sortItems(colItems).map((item) => {
                        const isFolder = !item.ext;
                        const isActive = columnPaths[colIdx + 1] === item.path;
                        return (
                          <button
                            key={item.path}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted',
                              isActive && 'bg-accent',
                            )}
                            onClick={() => {
                              if (isFolder) handleColumnNavigate(item.path, colIdx);
                              setSelectedItems(new Set([item.path]));
                            }}
                            onDoubleClick={() => {
                              if (!isFolder) openInEditor(item.path);
                            }}
                          >
                            {isFolder ? (
                              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate text-left">{item.name}</span>
                            {isFolder && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TREE VIEW */}
          {viewMode === 'tree' && (
            <div className="p-2">
              {treeItems['/'] ? renderTreeNode(treeItems['/'], 0) : (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Properties panel */}
      {propertiesPath && projectId && (
        <PropertiesPanel
          projectId={projectId}
          path={propertiesPath}
          onClose={() => setPropertiesPath(null)}
        />
      )}

      {/* Create page dialog */}
      {projectId && (
        <CreatePageDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          projectId={projectId}
          currentPath={currentPath}
          onCreated={handleRefresh}
        />
      )}
    </div>
  );
}
