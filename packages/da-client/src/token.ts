import type { DATokenEnv, TokenCache } from './types.js';

const IMS_TOKEN_ENDPOINT = 'https://ims-na1.adobelogin.com/ims/token/v3';
const KV_CACHE_KEY = 'da_access_token';
const TOKEN_MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 hours

async function exchangeForAccessToken(
  clientId: string,
  clientSecret: string,
  serviceToken: string,
): Promise<string> {
  const formParams = new URLSearchParams();
  formParams.append('grant_type', 'authorization_code');
  formParams.append('client_id', clientId);
  formParams.append('client_secret', clientSecret);
  formParams.append('code', serviceToken);

  const response = await fetch(IMS_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IMS token exchange failed: ${response.status} — ${errorText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('No access token received from IMS');
  }

  return data.access_token;
}

export async function getDAToken(
  env: DATokenEnv,
  userImsToken?: string,
): Promise<string> {
  if (userImsToken) return userImsToken;

  // Check KV cache
  if (env.DA_TOKEN_CACHE) {
    try {
      const cached = (await env.DA_TOKEN_CACHE.get(KV_CACHE_KEY, { type: 'json' })) as TokenCache | null;
      if (cached && Date.now() - cached.obtainedAt < TOKEN_MAX_AGE_MS) {
        return cached.token;
      }
    } catch {
      // Cache miss or error — continue to fresh token
    }
  }

  const accessToken = await exchangeForAccessToken(
    env.DA_CLIENT_ID,
    env.DA_CLIENT_SECRET,
    env.DA_SERVICE_TOKEN,
  );

  // Cache the token
  if (env.DA_TOKEN_CACHE) {
    try {
      const cacheData: TokenCache = { token: accessToken, obtainedAt: Date.now() };
      await env.DA_TOKEN_CACHE.put(KV_CACHE_KEY, JSON.stringify(cacheData), {
        expirationTtl: 23 * 60 * 60,
      });
    } catch {
      // Non-fatal: token works, caching failed
    }
  }

  return accessToken;
}

export async function clearCachedToken(env: DATokenEnv): Promise<void> {
  if (env.DA_TOKEN_CACHE) {
    try {
      await env.DA_TOKEN_CACHE.delete(KV_CACHE_KEY);
    } catch {
      // Non-fatal
    }
  }
}
