const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/login';
      throw new ApiError(401, 'Unauthorized');
    }
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  return response.json() as Promise<T>;
}

// Types
export interface Project {
  id: string;
  name: string;
  slug: string;
  da_org: string;
  da_repo: string;
}

export interface ListItem {
  name: string;
  path: string;
  ext?: string;
  lastModified?: string;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
  source: 'keyword' | 'semantic';
}

export interface PageProperties {
  path: string;
  deliveryMode: string;
  annotations: Array<{
    id?: string;
    audience?: string;
    situation?: string;
    outcome?: string;
    composite_score?: number;
  }>;
}

export interface AISuggestion {
  text: string;
  prompt: string;
}

export interface BlockDefinition {
  name: string;
  category: string;
  description: string;
  structure: string;
  variants: string[];
  generativeConfig?: Record<string, unknown>;
  valueMetadata?: Record<string, unknown>;
  isCustom?: boolean;
}

export interface AssetItem {
  name: string;
  path: string;
  ext: string;
  lastModified?: string;
}

export const api = {
  // Auth
  getMe: () =>
    request<{
      user: { id: string; email: string; name: string; avatarUrl: string };
      org: { id: string; slug: string; name: string };
    }>('/auth/me'),
  loginWithGitHub: (code: string) =>
    request('/auth/github/callback', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Org
  getProjects: () => request<{ projects: Project[] }>('/org/projects'),
  createProject: (data: { name: string; slug: string; daOrg: string; daRepo: string }) =>
    request<{ id: string }>('/org/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Content
  listPages: (projectId: string, path: string = '/') =>
    request<{ items: ListItem[] }>(`/content/${projectId}/list?path=${encodeURIComponent(path)}`),
  getPageSource: (projectId: string, path: string) =>
    request<{ content: string; contentType: string }>(`/content/${projectId}/source?path=${encodeURIComponent(path)}`),
  createPage: (projectId: string, path: string, content: string) =>
    request(`/content/${projectId}/source`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  deletePage: (projectId: string, path: string) =>
    request(`/content/${projectId}/source?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  copyPage: (projectId: string, source: string, destination: string) =>
    request(`/content/${projectId}/copy`, { method: 'POST', body: JSON.stringify({ source, destination }) }),
  movePage: (projectId: string, source: string, destination: string) =>
    request(`/content/${projectId}/move`, { method: 'POST', body: JSON.stringify({ source, destination }) }),

  // Properties
  getProperties: (projectId: string, path: string) =>
    request<PageProperties>(`/content/${projectId}/properties?path=${encodeURIComponent(path)}`),
  updateProperties: (projectId: string, data: { path: string; deliveryMode?: string; annotation?: { audience?: string; situation?: string; outcome?: string } }) =>
    request(`/content/${projectId}/properties`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnotation: (projectId: string, id: string) =>
    request(`/content/${projectId}/annotation?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Templates
  getTemplates: (projectId: string) =>
    request<{ templates: PageTemplate[] }>(`/content/${projectId}/templates`),

  // Suggestions
  getSuggestions: (projectId: string) =>
    request<{ suggestions: AISuggestion[] }>(`/content/${projectId}/suggestions`),

  // AI
  executeAI: (projectId: string, prompt: string) =>
    request<{
      response: string;
      toolCalls: Array<{ name: string; input: Record<string, string>; result: string }>;
    }>(`/ai/${projectId}/execute`, { method: 'POST', body: JSON.stringify({ prompt }) }),
  getActionHistory: (projectId: string, limit: number = 20) =>
    request<{
      actions: Array<{ id: string; action_type: string; description: string; created_at: string }>;
    }>(`/ai/${projectId}/history?limit=${limit}`),

  // Preview & Publish
  previewPage: (projectId: string, path: string) =>
    request<{ ok: boolean; url: string }>(`/content/${projectId}/preview`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  publishPage: (projectId: string, path: string) =>
    request<{ ok: boolean; url: string }>(`/content/${projectId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // Assets
  listAssets: (projectId: string, path: string = '/media') =>
    request<{ assets: AssetItem[] }>(`/content/${projectId}/assets?path=${encodeURIComponent(path)}`),
  uploadAsset: async (projectId: string, path: string, file: File): Promise<{ ok: boolean; url: string; path: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    const response = await fetch(`${API_BASE}/content/${projectId}/assets`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.json();
  },

  // Block Library
  getBlockLibrary: (projectId: string) =>
    request<{ blocks: BlockDefinition[] }>(`/content/${projectId}/block-library`),

  // Blocks (DB CRUD)
  updateBlockMetadata: (projectId: string, data: { name: string; category?: string; generativeConfig?: object; valueMetadata?: object }) =>
    request(`/blocks/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Search
  search: (projectId: string, query: string) =>
    request<{ results: SearchResult[]; query: string }>(`/search/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};
