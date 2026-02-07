import { DAAdminClient } from '@nova/da-client';
import type { Env } from '../lib/types.js';

/**
 * Create a DA client scoped to a project's org/repo.
 */
export function createDAClient(env: Env, daOrg: string, daRepo: string): DAAdminClient {
  return new DAAdminClient(
    {
      DA_CLIENT_ID: env.DA_CLIENT_ID,
      DA_CLIENT_SECRET: env.DA_CLIENT_SECRET,
      DA_SERVICE_TOKEN: env.DA_SERVICE_TOKEN,
      DA_ADMIN_HOST: env.DA_ADMIN_HOST,
      DA_TOKEN_CACHE: env.DA_TOKEN_CACHE,
    },
    daOrg,
    daRepo,
  );
}

/**
 * Get a DA client for a project by ID (looks up org/repo from D1).
 */
export async function getDAClientForProject(
  env: Env,
  projectId: string,
): Promise<DAAdminClient> {
  const project = await env.DB.prepare(
    'SELECT da_org, da_repo FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first<{ da_org: string; da_repo: string }>();

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return createDAClient(env, project.da_org, project.da_repo);
}
