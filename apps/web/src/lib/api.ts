const API_BASE = '/api';

// For SSE streaming, connect directly to the worker to bypass Vite proxy buffering.
// In production, SSE goes through the same origin; in dev, wrangler runs on :8787.
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:8787/api' : '/api';

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

export interface AssetDetail {
  id: string;
  path: string;
  name: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  altText: string;
  tags: string[];
  colorPalette: string[];
  updatedAt: string;
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
  loginWithIMS: (code: string) =>
    request('/auth/ims/callback', { method: 'POST', body: JSON.stringify({ code }) }),
  switchOrg: (orgId: string) =>
    request('/auth/switch-org', { method: 'POST', body: JSON.stringify({ orgId }) }),
  getOrgs: () =>
    request<{ orgs: Array<{ id: string; name: string; slug: string; role: string }> }>('/auth/orgs'),
  updatePreferences: (preferences: Record<string, unknown>) =>
    request('/auth/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),
  devLogin: () => request('/auth/dev-login', { method: 'POST' }),
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

  // WYSIWYG
  getWysiwygUrl: (projectId: string, path: string) =>
    `/api/content/${projectId}/wysiwyg?path=${encodeURIComponent(path)}`,

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
  listAssets: (projectId: string, path: string = '/', search?: string) =>
    request<{ assets: AssetDetail[] }>(`/assets/${projectId}/list?path=${encodeURIComponent(path)}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  uploadAsset: async (projectId: string, path: string, file: File): Promise<{ ok: boolean; asset: AssetDetail }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    const response = await fetch(`${API_BASE}/assets/${projectId}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.json();
  },
  updateAsset: (projectId: string, assetId: string, data: { altText?: string; tags?: string[] }) =>
    request(`/assets/${projectId}/${assetId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAsset: (projectId: string, assetId: string) =>
    request(`/assets/${projectId}/${assetId}`, { method: 'DELETE' }),
  getAssetUrl: (projectId: string, path: string) =>
    `/api/assets/${projectId}/file?path=${encodeURIComponent(path)}`,
  generateImage: (projectId: string, prompt: string, style?: string) =>
    request<{ ok: boolean; generation: { refinedPrompt: string; suggestedAltText: string; suggestedTags: string[]; suggestedFileName: string } }>(`/assets/${projectId}/generate`, {
      method: 'POST', body: JSON.stringify({ prompt, style }),
    }),

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

  // SEO
  getSeoPages: (projectId: string) =>
    request<{ pages: SeoMetadata[] }>(`/seo/${projectId}`),
  getPageSeo: (projectId: string, path: string) =>
    request<{ seo: SeoMetadata | null }>(`/seo/${projectId}/page?path=${encodeURIComponent(path)}`),
  updatePageSeo: (projectId: string, data: { path: string; title?: string; description?: string; keywords?: string[]; canonicalUrl?: string; ogImage?: string; structuredData?: object; robots?: string }) =>
    request(`/seo/${projectId}/page`, { method: 'PUT', body: JSON.stringify(data) }),
  analyzeSeo: (projectId: string, path: string) =>
    request<{ ok: boolean; analysis: SeoAnalysis }>(`/seo/${projectId}/analyze`, { method: 'POST', body: JSON.stringify({ path }) }),
  generateStructuredData: (projectId: string, path: string, type?: string) =>
    request<{ ok: boolean; structuredData: Record<string, unknown> }>(`/seo/${projectId}/generate-structured-data`, { method: 'POST', body: JSON.stringify({ path, type }) }),

  // Content Fragments
  getFragmentModels: (projectId: string) =>
    request<{ models: FragmentModel[] }>(`/fragments/${projectId}/models`),
  createFragmentModel: (projectId: string, data: { name: string; description?: string; schema: object }) =>
    request<{ ok: boolean; id: string }>(`/fragments/${projectId}/models`, { method: 'POST', body: JSON.stringify(data) }),
  updateFragmentModel: (projectId: string, modelId: string, data: { name?: string; description?: string; schema?: object }) =>
    request(`/fragments/${projectId}/models/${modelId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFragmentModel: (projectId: string, modelId: string) =>
    request(`/fragments/${projectId}/models/${modelId}`, { method: 'DELETE' }),
  getFragments: (projectId: string, modelId?: string) =>
    request<{ fragments: ContentFragment[] }>(`/fragments/${projectId}${modelId ? `?modelId=${modelId}` : ''}`),
  getFragment: (projectId: string, fragmentId: string) =>
    request<{ fragment: ContentFragment & { modelSchema: Record<string, unknown> } }>(`/fragments/${projectId}/${fragmentId}`),
  createFragment: (projectId: string, data: { modelId: string; title: string; slug: string; data: object; status?: string; tags?: string[] }) =>
    request<{ ok: boolean; id: string }>(`/fragments/${projectId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateFragment: (projectId: string, fragmentId: string, data: { title?: string; data?: object; status?: string; tags?: string[] }) =>
    request(`/fragments/${projectId}/${fragmentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFragment: (projectId: string, fragmentId: string) =>
    request(`/fragments/${projectId}/${fragmentId}`, { method: 'DELETE' }),
  generateFragmentContent: (projectId: string, modelId: string, prompt: string) =>
    request<{ ok: boolean; generated: { title: string; slug: string; data: Record<string, unknown> } }>(`/fragments/${projectId}/generate`, { method: 'POST', body: JSON.stringify({ modelId, prompt }) }),

  // Enterprise — Workflows
  getWorkflows: (projectId: string, status?: string) =>
    request<{ workflows: Workflow[] }>(`/enterprise/${projectId}/workflows${status ? `?status=${status}` : ''}`),
  createWorkflow: (projectId: string, data: { name: string; type?: string; path?: string; description?: string; assignedTo?: string; dueDate?: string; steps?: Array<{ name: string; type?: string; assignedTo?: string }> }) =>
    request<{ ok: boolean; id: string }>(`/enterprise/${projectId}/workflows`, { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflow: (projectId: string, workflowId: string, data: { status?: string; assignedTo?: string; comment?: string }) =>
    request(`/enterprise/${projectId}/workflows/${workflowId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getWorkflowSteps: (projectId: string, workflowId: string) =>
    request<{ steps: WorkflowStep[] }>(`/enterprise/${projectId}/workflows/${workflowId}/steps`),
  completeWorkflowStep: (projectId: string, workflowId: string, stepId: string, data: { status: string; comment?: string }) =>
    request(`/enterprise/${projectId}/workflows/${workflowId}/steps/${stepId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Enterprise — Launches
  getLaunches: (projectId: string) =>
    request<{ launches: Launch[] }>(`/enterprise/${projectId}/launches`),
  createLaunch: (projectId: string, data: { name: string; description?: string; paths?: string[]; scheduledAt?: string }) =>
    request<{ ok: boolean; id: string; sourceBranch: string }>(`/enterprise/${projectId}/launches`, { method: 'POST', body: JSON.stringify(data) }),
  updateLaunch: (projectId: string, launchId: string, data: { status?: string; scheduledAt?: string; paths?: string[] }) =>
    request(`/enterprise/${projectId}/launches/${launchId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLaunch: (projectId: string, launchId: string) =>
    request(`/enterprise/${projectId}/launches/${launchId}`, { method: 'DELETE' }),

  // Enterprise — Notifications
  getNotifications: (unreadOnly?: boolean) =>
    request<{ notifications: Notification[] }>(`/enterprise/notifications/inbox${unreadOnly ? '?unread=true' : ''}`),
  markNotificationRead: (notificationId: string) =>
    request(`/enterprise/notifications/${notificationId}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    request('/enterprise/notifications/mark-all-read', { method: 'POST' }),

  // Enterprise — Translations
  getTranslations: (projectId: string) =>
    request<{ translations: Translation[] }>(`/enterprise/${projectId}/translations`),
  createTranslation: (projectId: string, data: { sourcePath: string; sourceLocale?: string; targetLocale: string; provider?: string }) =>
    request<{ ok: boolean; id: string; targetPath: string; translated?: string; status: string }>(`/enterprise/${projectId}/translations`, { method: 'POST', body: JSON.stringify(data) }),
  updateTranslation: (projectId: string, translationId: string, status: string) =>
    request(`/enterprise/${projectId}/translations/${translationId}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Enterprise — Bulk
  bulkOperation: (projectId: string, operation: string, paths: string[]) =>
    request<{ ok: boolean; results: Array<{ path: string; ok: boolean; error?: string }> }>(`/enterprise/${projectId}/bulk`, { method: 'POST', body: JSON.stringify({ operation, paths }) }),

  // Brand
  getBrandProfiles: (projectId: string) =>
    request<{ profiles: BrandProfile[] }>(`/brand/${projectId}`),
  getBrandProfile: (projectId: string, name: string) =>
    request<{ profile: BrandProfile }>(`/brand/${projectId}/${encodeURIComponent(name)}`),
  saveBrandProfile: (projectId: string, name: string, data: { voice?: object; visual?: object; contentRules?: object; designTokens?: object }) =>
    request(`/brand/${projectId}/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBrandProfile: (projectId: string, name: string) =>
    request(`/brand/${projectId}/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  validateVoice: (projectId: string, text: string, profileName?: string) =>
    request<{ ok: boolean; validation: VoiceValidation }>(`/brand/${projectId}/validate-voice`, {
      method: 'POST', body: JSON.stringify({ text, profileName }),
    }),
  checkVisual: (projectId: string, data: { css?: string; html?: string; profileName?: string }) =>
    request<{ ok: boolean; check: VisualCheck }>(`/brand/${projectId}/check-visual`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  runBrandAudit: (projectId: string, profileName?: string) =>
    request<{ ok: boolean; audit: BrandAudit }>(`/brand/${projectId}/audit`, {
      method: 'POST', body: JSON.stringify({ profileName }),
    }),

  // AI Streaming
  streamAI: (projectId: string, prompt: string, onEvent: (event: SSEStreamEvent) => void): AbortController => {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${SSE_BASE}/ai/${projectId}/stream`, {
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
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

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

export interface SeoMetadata {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  keywords: string[];
  canonicalUrl: string | null;
  ogImage: string | null;
  structuredData: Record<string, unknown>;
  robots: string;
  internalLinks: Array<{ targetPath: string; anchorText: string; reason: string }>;
  seoScore: number | null;
  llmCitabilityScore: number | null;
  updatedAt?: string;
}

export interface SeoAnalysis {
  seoScore: number;
  llmCitabilityScore: number;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedKeywords: string[];
  structuredData: Record<string, unknown>;
  internalLinks: Array<{ targetPath: string; anchorText: string; reason: string }>;
  issues: Array<{ severity: string; description: string; fix: string }>;
  llmIssues: Array<{ description: string; fix: string }>;
}

export interface FragmentModel {
  id: string;
  name: string;
  description: string | null;
  schema: Record<string, unknown>;
  createdAt: string;
}

export interface ContentFragment {
  id: string;
  modelId: string;
  modelName: string;
  title: string;
  slug: string;
  data: Record<string, unknown>;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: string;
  status: string;
  path: string | null;
  description: string | null;
  assignedTo: string | null;
  createdBy: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  type: string;
  status: string;
  assignedTo: string | null;
  completedBy: string | null;
  comment: string | null;
  completedAt: string | null;
}

export interface Launch {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sourceBranch: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  paths: string[];
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface Translation {
  id: string;
  sourcePath: string;
  sourceLocale: string;
  targetLocale: string;
  targetPath: string | null;
  status: string;
  provider: string | null;
  createdAt: string;
}

export interface BrandProfile {
  id: string;
  name: string;
  voice: BrandVoice;
  visual: BrandVisual;
  contentRules: Record<string, unknown>;
  designTokens: Record<string, unknown>;
  updatedAt: string;
}

export interface BrandVoice {
  tone?: string;
  personality?: string;
  dos?: string[];
  donts?: string[];
}

export interface BrandVisual {
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, string>;
}

export interface VoiceValidation {
  score: number;
  issues: Array<{ severity: string; description: string; suggestion: string }>;
  strengths: string[];
  rewriteSuggestion: string | null;
}

export interface VisualCheck {
  compliant: boolean;
  score: number;
  issues: Array<{ type: string; severity: string; description: string; fix: string }>;
  suggestions: string[];
}

export interface BrandAudit {
  overallScore: number;
  summary: string;
  pages: Array<{ path: string; score: number; issues: string[]; suggestions: string[] }>;
  trends: string[];
  recommendations: string[];
}

export interface SSEStreamEvent {
  event: string;
  data: Record<string, unknown>;
}
