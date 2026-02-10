import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const IMS_CLIENT_ID = import.meta.env.VITE_IMS_CLIENT_ID || '';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, devLogin, loginWithGitHub, loginWithIMS, loading, error } = useAuth();

  // Handle OAuth callback
  const code = searchParams.get('code');
  const provider = searchParams.get('provider') || (searchParams.get('state')?.startsWith('ims-') ? 'ims' : 'github');

  // Auto-redirect to /sites when not handling an OAuth callback
  // (AuthenticatedRoutes will auto-provision a demo session)
  useEffect(() => {
    if (!code) {
      navigate('/sites');
    }
  }, [code, navigate]);

  useEffect(() => {
    if (code) {
      if (provider === 'ims') {
        loginWithIMS(code);
      } else {
        loginWithGitHub(code);
      }
    }
  }, [code, provider, loginWithGitHub, loginWithIMS]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/sites');
    }
  }, [user, navigate]);

  const handleGitHubLogin = () => {
    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user user:email',
      state,
      redirect_uri: `${window.location.origin}/login`,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  const handleIMSLogin = () => {
    const state = `ims-${crypto.randomUUID()}`;
    const params = new URLSearchParams({
      client_id: IMS_CLIENT_ID,
      scope: 'openid,AdobeID,read_organizations',
      response_type: 'code',
      state,
      redirect_uri: `${window.location.origin}/login?provider=ims`,
    });
    window.location.href = `https://ims-na1.adobelogin.com/ims/authorize/v2?${params}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-ai-cyan/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-ai-indigo/15 blur-3xl" />
        <div className="absolute right-20 bottom-20 h-[300px] w-[300px] rounded-full bg-ai-fuchsia/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-emphasized">
            <span className="text-2xl font-extrabold">N</span>
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Nova</h1>
            <p className="mt-2 text-base text-muted-foreground">AI-native Content Management</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        {/* Login card */}
        <div className="rounded-2xl border bg-background-layer-2 p-6 shadow-emphasized space-y-4">
          {IMS_CLIENT_ID && (
            <Button onClick={handleIMSLogin} size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : 'Sign in with Adobe'}
            </Button>
          )}

          {IMS_CLIENT_ID && GITHUB_CLIENT_ID && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
          )}

          {GITHUB_CLIENT_ID && (
            <Button
              onClick={handleGitHubLogin}
              variant={IMS_CLIENT_ID ? 'outline' : 'default'}
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : 'Sign in with GitHub'}
            </Button>
          )}
        </div>

        {import.meta.env.DEV && (
          <Button
            onClick={devLogin}
            variant="ghost"
            size="sm"
            className="mx-auto"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : 'Dev Login'}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Built on AEM Edge Delivery Services
        </p>
      </div>
    </div>
  );
}
