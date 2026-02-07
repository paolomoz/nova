import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Globe, FileText, Image, Sparkles, Settings, LogOut, Blocks, Palette, Building2, Search, FileJson, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r bg-muted/40 py-4">
        <div className="mb-8 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          N
        </div>

        <nav className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  size="icon"
                  className={cn('h-10 w-10', active && 'bg-secondary')}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          {/* Org switcher */}
          {orgs.length > 1 && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={org?.name || 'Switch org'}
                onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
              {orgMenuOpen && (
                <div className="absolute bottom-10 left-0 z-50 w-48 rounded-md border bg-popover p-1 shadow-md">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Organizations</div>
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      className={cn(
                        'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
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
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full" />
          )}
          <Button variant="ghost" size="icon" onClick={logout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
