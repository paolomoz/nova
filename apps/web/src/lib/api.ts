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

export interface BlockDetail {
  id: string;
  name: string;
  category: string;
  description: string;
  structureHtml: string;
  css: string;
  js: string;
  status: string;
  codePath: string;
  githubBranch: string;
  githubPrUrl: string;
  generativeConfig: Record<string, unknown>;
  valueMetadata: Record<string, unknown>;
}

export interface GeneratedBlockResult {
  name: string;
  description: string;
  category: string;
  structureHtml: string;
  css: string;
  js: string;
  variants: string[];
  previewHtml: string;
}

export interface GenerativeConfigItem {
  id: string;
  pathPattern: string;
  deliveryMode: string;
  intentConfig: Record<string, unknown>;
  confidenceThresholds: Record<string, unknown>;
  signalConfig: Record<string, unknown>;
  blockConstraints: Record<string, unknown>;
}

export interface GenerationRecord {
  id: string;
  description: string;
  input: { query?: string; intent?: string };
  output: { blocks?: number; persisted?: string | null };
  createdAt: string;
}

export interface GenerativeStats {
  totalGenerations: number;
  daily: Array<{ date: string; count: number }>;
  performance: {
    avgLcp: number | null;
    avgInp: number | null;
    avgCls: number | null;
    totalViews: number;
  };
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

  // Blocks
  getBlocks: (projectId: string) =>
    request<{ blocks: BlockDefinition[] }>(`/blocks/${projectId}`),
  getBlock: (projectId: string, blockId: string) =>
    request<{ block: BlockDetail }>(`/blocks/${projectId}/${blockId}`),
  createBlock: (projectId: string, data: { name: string; category?: string; description?: string; generativeConfig?: object; valueMetadata?: object }) =>
    request<{ ok: boolean; id: string }>(`/blocks/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateBlock: (projectId: string, blockId: string, data: { name?: string; category?: string; description?: string; structureHtml?: string; css?: string; js?: string; generativeConfig?: object; valueMetadata?: object }) =>
    request(`/blocks/${projectId}/${blockId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBlock: (projectId: string, blockId: string) =>
    request(`/blocks/${projectId}/${blockId}`, { method: 'DELETE' }),
  generateBlock: (projectId: string, intent: string) =>
    request<{ ok: boolean; id: string; block: GeneratedBlockResult }>(`/blocks/${projectId}/generate`, {
      method: 'POST', body: JSON.stringify({ intent }),
    }),
  iterateBlock: (projectId: string, blockId: string, feedback: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    request<{ ok: boolean; block: GeneratedBlockResult }>(`/blocks/${projectId}/${blockId}/iterate`, {
      method: 'POST', body: JSON.stringify({ feedback, history }),
    }),
  commitBlock: (projectId: string, blockId: string) =>
    request<{ ok: boolean; commit: { sha: string; branch: string }; pr: { number: number; url: string } }>(`/blocks/${projectId}/${blockId}/commit`, { method: 'POST' }),
  getBlockPreviewUrl: (projectId: string, blockId: string) =>
    `/api/blocks/${projectId}/${blockId}/preview`,

  // Search
  search: (projectId: string, query: string) =>
    request<{ results: SearchResult[]; query: string }>(`/search/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Design
  generateDesign: (projectId: string, intent: string) =>
    request<{ ok: boolean; design: { tokens: Record<string, Record<string, string>>; css: string; styleGuideHtml: string; theme?: { light: Record<string, string>; dark: Record<string, string> } } }>(`/design/${projectId}/generate`, {
      method: 'POST', body: JSON.stringify({ intent }),
    }),
  bootstrapSite: (projectId: string, description: string) =>
    request<{ ok: boolean; design: Record<string, unknown>; pages: Array<{ path: string; title: string; html: string }> }>(`/design/${projectId}/bootstrap`, {
      method: 'POST', body: JSON.stringify({ description }),
    }),
  getDesignTokens: (projectId: string) =>
    request<{ tokens: Record<string, Record<string, string>> | null }>(`/design/${projectId}/tokens`),
  updateDesignTokens: (projectId: string, tokens: Record<string, unknown>) =>
    request(`/design/${projectId}/tokens`, { method: 'PUT', body: JSON.stringify({ tokens }) }),
  commitDesign: (projectId: string) =>
    request<{ ok: boolean; commit: { sha: string }; pr: { number: number; url: string } }>(`/design/${projectId}/commit`, { method: 'POST' }),
  generateTheme: (projectId: string, variant: string) =>
    request<{ ok: boolean; theme: Record<string, unknown> }>(`/design/${projectId}/theme`, {
      method: 'POST', body: JSON.stringify({ variant }),
    }),

  // Generative config
  getGenerativeConfigs: (projectId: string) =>
    request<{ configs: GenerativeConfigItem[] }>(`/generative/${projectId}/config`),
  upsertGenerativeConfig: (projectId: string, data: { pathPattern: string; deliveryMode: string; intentConfig?: object; confidenceThresholds?: object; signalConfig?: object; blockConstraints?: object }) =>
    request(`/generative/${projectId}/config`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGenerativeConfig: (projectId: string, configId: string) =>
    request(`/generative/${projectId}/config/${configId}`, { method: 'DELETE' }),

  // Generative monitoring
  getGenerativeRecent: (projectId: string, limit = 50) =>
    request<{ generations: GenerationRecord[] }>(`/generative/${projectId}/monitoring/recent?limit=${limit}`),
  getGenerativeStats: (projectId: string, days = 30) =>
    request<GenerativeStats>(`/generative/${projectId}/monitoring/stats?days=${days}`),

  // AI Streaming
  streamAI: (projectId: string, prompt: string, onEvent: (event: SSEStreamEvent) => void): AbortController => {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/ai/${projectId}/stream`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        });

        if (!response.ok) {
          onEvent({ event: 'error', data: { error: `HTTP ${response.status}` } });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                onEvent({ event: currentEvent, data });
              } catch {
                // Invalid JSON — skip
              }
              currentEvent = '';
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onEvent({ event: 'error', data: { error: (err as Error).message } });
        }
      }
    })();

    return controller;
  },
};

export interface SSEStreamEvent {
  event: string;
  data: Record<string, unknown>;
}
