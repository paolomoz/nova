import { useState, useEffect, useRef } from 'react';
import { Globe, FolderTree, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/lib/project';

interface ContextPickerProps {
  /** Called when the scope changes */
  onScopeChange?: (scope: ContextScope) => void;
  /** Current scope */
  scope?: ContextScope;
  /** Additional className */
  className?: string;
}

export interface ContextScope {
  type: 'project' | 'path';
  projectId: string;
  path?: string;
  label: string;
}

export function ContextPicker({ onScopeChange, scope, className }: ContextPickerProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { projects, activeProjectId } = useProject();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = scope?.label || 'Entire project';
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleSelect = (newScope: ContextScope) => {
    onScopeChange?.(newScope);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
      >
        <Globe className="h-3 w-3" />
        <span className="max-w-[120px] truncate">{currentLabel}</span>
        <ChevronDown className={cn(
          'h-3 w-3 transition-transform duration-150',
          open && 'rotate-180',
        )} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border bg-popover p-1 shadow-elevated animate-fade-in">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">AI Scope</div>

          {/* Entire project */}
          {activeProject && (
            <button
              onClick={() => handleSelect({
                type: 'project',
                projectId: activeProject.id,
                label: activeProject.name,
              })}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-accent',
                scope?.type === 'project' && 'bg-accent',
              )}
            >
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{activeProject.name}</span>
              {scope?.type === 'project' && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          )}

          {/* Common paths */}
          {activeProject && (
            <>
              <div className="my-1 border-t border-border" />
              <div className="px-2 py-1 text-xs text-muted-foreground">Scope to path</div>
              {['/blog', '/products', '/about'].map((path) => (
                <button
                  key={path}
                  onClick={() => handleSelect({
                    type: 'path',
                    projectId: activeProject.id,
                    path,
                    label: path,
                  })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-accent',
                    scope?.type === 'path' && scope.path === path && 'bg-accent',
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{path}</span>
                  {scope?.type === 'path' && scope.path === path && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
