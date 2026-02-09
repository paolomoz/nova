import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useAILayout } from '@/lib/ai-layout';
import { Globe, FileText, Image, Sparkles, Settings, LogOut, Blocks, Palette, Building2, Search, FileJson, ChevronsUpDown, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AIRail } from '@/components/ai/ai-rail';

const navItems = [
  { path: '/sites', label: 'Sites', icon: Globe },
  { path: '/editor', label: 'Editor', icon: FileText },
  { path: '/blocks', label: 'Blocks', icon: Blocks },
  { path: '/assets', label: 'Assets', icon: Image },
  { path: '/brand', label: 'Brand', icon: Palette },
  { path: '/generative', label: 'Generative', icon: Sparkles },
  { path: '/enterprise', label: 'Enterprise', icon: Building2 },
  { path: '/seo', label: 'SEO', icon: Search },
  { path: '/fragments', label: 'Fragments', icon: FileJson },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, org, orgs, logout, switchOrg } = useAuth();
  const { mode, toggle, railPush } = useAILayout();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  const isRailOpen = mode === 'rail';

  // Close org menu on outside click
  useEffect(() => {
    if (!orgMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [orgMenuOpen]);

  // Cmd+. to toggle AI Rail
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        toggle('rail');
      }
      if (e.key === '.' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        toggle('fullscreen');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return (
    <div className="flex h-screen">
      {/* Sidebar — Spectrum 2 nav rail */}
      <aside className="flex w-16 flex-col items-center border-r border-border bg-background py-4">
        {/* Logo */}
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-extrabold">
          N
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-accent text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto flex flex-col items-center gap-2">
          {/* AI Assistant toggle */}
          <button
            onClick={() => toggle('rail')}
            title="AI Assistant (Cmd+.)"
            aria-label="Toggle AI Assistant"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150',
              isRailOpen
                ? 'ai-gradient-vivid text-white'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <MessageSquareText className="h-5 w-5" />
          </button>

          {/* Org switcher */}
          {orgs.length > 1 && (
            <div className="relative" ref={orgMenuRef}>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
                title={org?.name || 'Switch org'}
                aria-label="Switch organization"
                onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </button>
              {orgMenuOpen && (
                <div className="absolute bottom-10 left-0 z-50 w-48 rounded-xl border bg-popover p-1 shadow-elevated animate-fade-in">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Organizations</div>
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      className={cn(
                        'flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-accent',
                        o.id === org?.id && 'bg-accent font-medium',
                      )}
                      onClick={() => {
                        switchOrg(o.id);
                        setOrgMenuOpen(false);
                      }}
                    >
                      {o.name || o.slug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Avatar */}
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full ring-2 ring-transparent hover:ring-border transition-all duration-150"
            />
          ) : user ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          ) : null}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Logout */}
          <button
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main content + AI Rail */}
      <div className="relative flex flex-1 overflow-hidden">
        <main className={cn(
          'flex-1 overflow-auto bg-background transition-all duration-200',
          isRailOpen && railPush && 'mr-[360px]',
        )}>
          {children}
        </main>
        <AIRail />
      </div>
    </div>
  );
}
