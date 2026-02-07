import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Globe, FileText, Image, Sparkles, Settings, LogOut, Blocks, Palette, Building2, Search, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const { user, logout } = useAuth();

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
