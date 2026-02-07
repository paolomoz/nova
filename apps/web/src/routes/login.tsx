import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const IMS_CLIENT_ID = import.meta.env.VITE_IMS_CLIENT_ID || '';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loginWithGitHub, loginWithIMS, loading, error } = useAuth();

  // Handle OAuth callback
  const code = searchParams.get('code');
  const provider = searchParams.get('provider') || (searchParams.get('state')?.startsWith('ims-') ? 'ims' : 'github');
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
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-4xl font-bold">Nova</h1>
          <p className="mt-2 text-muted-foreground">AI-native Content Management</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <div className="space-y-3">
          {IMS_CLIENT_ID && (
            <Button onClick={handleIMSLogin} size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in with Adobe'}
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
            <Button onClick={handleGitHubLogin} variant={IMS_CLIENT_ID ? 'outline' : 'default'} size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in with GitHub'}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Built on AEM Edge Delivery Services
        </p>
      </div>
    </div>
  );
}
