import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginWithGitHub, loading, error } = useAuth();

  // Handle OAuth callback
  const code = searchParams.get('code');
  useEffect(() => {
    if (code) {
      loginWithGitHub(code);
    }
  }, [code, loginWithGitHub]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/sites');
    }
  }, [user, navigate]);

  const handleLogin = () => {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user user:email',
      state,
      redirect_uri: `${window.location.origin}/login`,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-4xl font-bold">Nova</h1>
          <p className="mt-2 text-muted-foreground">AI-native Content Management</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <Button onClick={handleLogin} size="lg" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in with GitHub'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Built on AEM Edge Delivery Services
        </p>
      </div>
    </div>
  );
}
