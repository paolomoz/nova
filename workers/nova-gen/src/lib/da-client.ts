import { DAAdminClient, type DATokenEnv } from '@nova/da-client';

interface GenEnv {
  DA_CLIENT_ID: string;
  DA_CLIENT_SECRET: string;
  DA_SERVICE_TOKEN: string;
  DA_ADMIN_HOST?: string;
  DA_TOKEN_CACHE?: KVNamespace;
}

export function createDAClient(env: GenEnv, org: string, repo: string): DAAdminClient {
  const tokenEnv: DATokenEnv = {
    DA_CLIENT_ID: env.DA_CLIENT_ID,
    DA_CLIENT_SECRET: env.DA_CLIENT_SECRET,
    DA_SERVICE_TOKEN: env.DA_SERVICE_TOKEN,
    DA_ADMIN_HOST: env.DA_ADMIN_HOST,
    DA_TOKEN_CACHE: env.DA_TOKEN_CACHE,
  };
  return new DAAdminClient(tokenEnv, org, repo);
}
