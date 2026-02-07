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

export const api = {
  // Auth
  getMe: () => request<{ user: { id: string; email: string; name: string; avatarUrl: string }; org: { id: string; slug: string; name: string } }>('/auth/me'),
  loginWithGitHub: (code: string) => request('/auth/github/callback', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Org
  getProjects: () => request<{ projects: Array<{ id: string; name: string; slug: string; da_org: string; da_repo: string }> }>('/org/projects'),
  createProject: (data: { name: string; slug: string; daOrg: string; daRepo: string }) =>
    request<{ id: string }>('/org/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Content
  listPages: (projectId: string, path: string = '/') =>
    request<{ items: Array<{ name: string; path: string; ext?: string; lastModified?: string }> }>(`/content/${projectId}/list?path=${encodeURIComponent(path)}`),
  getPageSource: (projectId: string, path: string) =>
    request<{ content: string; contentType: string }>(`/content/${projectId}/source?path=${encodeURIComponent(path)}`),
  createPage: (projectId: string, path: string, content: string) =>
    request(`/content/${projectId}/source`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  deletePage: (projectId: string, path: string) =>
    request(`/content/${projectId}/source?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  // AI
  executeAI: (projectId: string, prompt: string) =>
    request<{ response: string; toolCalls: Array<{ name: string; input: Record<string, string>; result: string }> }>(`/ai/${projectId}/execute`, { method: 'POST', body: JSON.stringify({ prompt }) }),
  getActionHistory: (projectId: string, limit: number = 20) =>
    request<{ actions: Array<{ id: string; action_type: string; description: string; created_at: string }> }>(`/ai/${projectId}/history?limit=${limit}`),

  // Search
  search: (projectId: string, query: string) =>
    request<{ results: Array<{ path: string; score: number; snippet?: string }> }>(`/search/${projectId}`, { method: 'POST', body: JSON.stringify({ query }) }),
};
