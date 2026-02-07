/**
 * EDS Admin API client for preview/publish operations.
 * Wraps admin.hlx.page endpoints.
 */

const AEM_ADMIN_HOST = 'https://admin.hlx.page';

export class EDSAdminClient {
  private org: string;
  private site: string;
  private ref: string;

  constructor(org: string, site: string, ref: string = 'main') {
    this.org = org;
    this.site = site;
    this.ref = ref;
  }

  async preview(path: string): Promise<{ url: string }> {
    const response = await fetch(
      `${AEM_ADMIN_HOST}/preview/${this.org}/${this.site}/${this.ref}${path}`,
      { method: 'POST' },
    );
    if (!response.ok) {
      throw new Error(`EDS preview failed: ${response.status}`);
    }
    return {
      url: `https://${this.ref}--${this.site}--${this.org}.aem.page${path}`,
    };
  }

  async publish(path: string): Promise<{ url: string }> {
    const response = await fetch(
      `${AEM_ADMIN_HOST}/live/${this.org}/${this.site}/${this.ref}${path}`,
      { method: 'POST' },
    );
    if (!response.ok) {
      throw new Error(`EDS publish failed: ${response.status}`);
    }
    return {
      url: `https://${this.ref}--${this.site}--${this.org}.aem.live${path}`,
    };
  }

  async status(path: string): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${AEM_ADMIN_HOST}/status/${this.org}/${this.site}/${this.ref}${path}`,
    );
    if (!response.ok) {
      throw new Error(`EDS status failed: ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}
