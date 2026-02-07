import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/shell/app-shell';
import { CommandBar } from '@/components/command-bar/command-bar';
import { LoginPage } from '@/routes/login';
import { SitesPage } from '@/routes/sites/index';
import { EditorPage } from '@/routes/editor/index';
import { AssetsPage } from '@/routes/assets/index';
import { GenerativePage } from '@/routes/generative/index';
import { BlocksPage } from '@/routes/blocks/index';
import { BrandPage } from '@/routes/brand/index';
import { SettingsPage } from '@/routes/settings/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AuthenticatedRoutes() {
  const { user, loading, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <AppShell>
      <CommandBar />
      <Routes>
        <Route path="/sites/*" element={<SitesPage />} />
        <Route path="/editor/*" element={<EditorPage />} />
        <Route path="/blocks/*" element={<BlocksPage />} />
        <Route path="/assets/*" element={<AssetsPage />} />
        <Route path="/generative/*" element={<GenerativePage />} />
        <Route path="/brand/*" element={<BrandPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/sites" />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AuthenticatedRoutes />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
