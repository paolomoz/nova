export interface DATokenEnv {
  DA_CLIENT_ID: string;
  DA_CLIENT_SECRET: string;
  DA_SERVICE_TOKEN: string;
  DA_ADMIN_HOST?: string;
  DA_TOKEN_CACHE?: KVNamespace;
}

export interface KVNamespace {
  get(key: string, options?: { type: 'json' }): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface TokenCache {
  token: string;
  obtainedAt: number;
}

export interface DAListResponse {
  children: DAListEntry[];
}

export interface DAListEntry {
  name: string;
  path: string;
  lastModified?: string;
  ext?: string;
}

export interface DASourceResponse {
  content: string;
  contentType: string;
  lastModified?: string;
}

export interface DAVersionEntry {
  id: string;
  timestamp: string;
  user?: string;
  label?: string;
}
