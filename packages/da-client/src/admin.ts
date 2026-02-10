import type { DATokenEnv, DAListEntry, DASourceResponse, DAVersionEntry } from './types.js';
import { getDAToken, clearCachedToken } from './token.js';

const DEFAULT_DA_ADMIN_HOST = 'https://admin.da.live';

export class DAAdminClient {
  private env: DATokenEnv;
  private org: string;
  private repo: string;
  private host: string;

  constructor(env: DATokenEnv, org: string, repo: string) {
    this.env = env;
    this.org = org;
    this.repo = repo;
    this.host = env.DA_ADMIN_HOST || DEFAULT_DA_ADMIN_HOST;
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await getDAToken(this.env);
    const url = `${this.host}${path}`;

    let response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init?.headers },
    });

    // Retry once on 401
    if (response.status === 401) {
      await clearCachedToken(this.env);
      const freshToken = await getDAToken(this.env);
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${freshToken}`, ...init?.headers },
      });
    }

    return response;
  }

  private basePath(): string {
    return `/${this.org}/${this.repo}`;
  }

  /** List contents of a directory */
  async list(path: string = '/'): Promise<DAListEntry[]> {
    const response = await this.fetch(`/list${this.basePath()}${path}`);
    if (!response.ok) {
      throw new Error(`DA list failed: ${response.status}`);
    }
    const data = (await response.json()) as DAListEntry[];
    // Strip the org/repo prefix from paths so callers get repo-relative paths
    const prefix = this.basePath();
    return data.map((entry) => ({
      ...entry,
      path: entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) || '/' : entry.path,
    }));
  }

  /** Get page source HTML */
  async getSource(path: string): Promise<DASourceResponse> {
    const response = await this.fetch(`/source${this.basePath()}${path}`);
    if (!response.ok) {
      throw new Error(`DA getSource failed: ${response.status}`);
    }
    const content = await response.text();
    return {
      content,
      contentType: response.headers.get('content-type') || 'text/html',
      lastModified: response.headers.get('last-modified') || undefined,
    };
  }

  /** Create or update a page with HTML content */
  async putSource(path: string, htmlContent: string): Promise<void> {
    const formData = new FormData();
    formData.append('data', new Blob([htmlContent], { type: 'text/html' }), 'index.html');

    const response = await this.fetch(`/source${this.basePath()}${path}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DA putSource failed: ${response.status} — ${error}`);
    }
  }

  /** Delete a page or directory */
  async deleteSource(path: string): Promise<void> {
    const response = await this.fetch(`/source${this.basePath()}${path}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`DA deleteSource failed: ${response.status}`);
    }
  }

  /** Copy a page or directory */
  async copy(sourcePath: string, destPath: string): Promise<void> {
    const response = await this.fetch(`/copy${this.basePath()}${sourcePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: `${this.basePath()}${destPath}` }),
    });
    if (!response.ok) {
      throw new Error(`DA copy failed: ${response.status}`);
    }
  }

  /** Move a page or directory */
  async move(sourcePath: string, destPath: string): Promise<void> {
    const response = await this.fetch(`/move${this.basePath()}${sourcePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: `${this.basePath()}${destPath}` }),
    });
    if (!response.ok) {
      throw new Error(`DA move failed: ${response.status}`);
    }
  }

  /** List versions of a page */
  async listVersions(path: string): Promise<DAVersionEntry[]> {
    const response = await this.fetch(`/versionsource${this.basePath()}${path}`);
    if (!response.ok) {
      throw new Error(`DA listVersions failed: ${response.status}`);
    }
    return (await response.json()) as DAVersionEntry[];
  }

  /** Upload media (image, etc.) */
  async uploadMedia(path: string, data: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append('data', data, filename);

    const response = await this.fetch(`/source${this.basePath()}${path}`, {
      method: 'PUT',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`DA uploadMedia failed: ${response.status}`);
    }

    return `${this.host}/source${this.basePath()}${path}`;
  }

  /** Trigger EDS preview via AEM Admin API */
  async preview(path: string, ref: string = 'main'): Promise<string> {
    // Admin API needs .html; EDS public URLs are extensionless
    const adminPath = path.endsWith('.html') ? path : `${path}.html`;
    const cleanPath = path.replace(/\.html$/, '');
    const token = await getDAToken(this.env);
    const response = await fetch(
      `https://admin.hlx.page/preview/${this.org}/${this.repo}/${ref}${adminPath}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new Error(`AEM preview failed: ${response.status}`);
    }
    return `https://${ref}--${this.repo}--${this.org}.aem.page${cleanPath}`;
  }

  /** Publish to live via AEM Admin API */
  async publish(path: string, ref: string = 'main'): Promise<string> {
    const adminPath = path.endsWith('.html') ? path : `${path}.html`;
    const cleanPath = path.replace(/\.html$/, '');
    const token = await getDAToken(this.env);
    const response = await fetch(
      `https://admin.hlx.page/live/${this.org}/${this.repo}/${ref}${adminPath}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new Error(`AEM publish failed: ${response.status}`);
    }
    return `https://${ref}--${this.repo}--${this.org}.aem.live${cleanPath}`;
  }
}
