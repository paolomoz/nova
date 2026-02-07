export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export function getGitHubAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'read:user user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`GitHub OAuth error: ${data.error || 'no access token'}`);
  }

  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Nova-CMS',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  const user = (await response.json()) as GitHubUser;

  // If email is not public, fetch from emails endpoint
  if (!user.email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Nova-CMS',
      },
    });
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
      }>;
      const primary = emails.find((e) => e.primary);
      if (primary) user.email = primary.email;
    }
  }

  return user;
}

/**
 * GitHub API client for repository operations (branches, commits, PRs).
 * Used by block generation pipeline to commit generated block code.
 */

interface GitHubFile {
  path: string;
  content: string;
}

interface GitHubCommitResult {
  sha: string;
  branch: string;
  url: string;
}

interface GitHubPRResult {
  number: number;
  url: string;
  htmlUrl: string;
}

export class GitHubRepoClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Nova-CMS',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API error: ${response.status} — ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
    const data = await this.request<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    );
    return data.object.sha;
  }

  async createBranch(owner: string, repo: string, branchName: string, baseBranch: string = 'main'): Promise<string> {
    const baseSha = await this.getBranchSha(owner, repo, baseBranch);
    await this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });
    return branchName;
  }

  async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    files: GitHubFile[],
    message: string,
  ): Promise<GitHubCommitResult> {
    const baseSha = await this.getBranchSha(owner, repo, branch);

    const blobs = await Promise.all(
      files.map(async (file) => {
        const blob = await this.request<{ sha: string }>(
          `/repos/${owner}/${repo}/git/blobs`,
          { method: 'POST', body: JSON.stringify({ content: file.content, encoding: 'utf-8' }) },
        );
        return { path: file.path, sha: blob.sha };
      }),
    );

    const baseCommit = await this.request<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${baseSha}`,
    );

    const tree = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseCommit.tree.sha,
          tree: blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
        }),
      },
    );

    const commit = await this.request<{ sha: string; html_url: string }>(
      `/repos/${owner}/${repo}/git/commits`,
      { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }) },
    );

    await this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });

    return { sha: commit.sha, branch, url: commit.html_url };
  }

  async createPR(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<GitHubPRResult> {
    const pr = await this.request<{ number: number; url: string; html_url: string }>(
      `/repos/${owner}/${repo}/pulls`,
      { method: 'POST', body: JSON.stringify({ title, body, head, base }) },
    );
    return { number: pr.number, url: pr.url, htmlUrl: pr.html_url };
  }

  async getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<string | null> {
    try {
      const endpoint = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
      const data = await this.request<{ content: string; encoding: string }>(endpoint);
      if (data.encoding === 'base64') return atob(data.content.replace(/\n/g, ''));
      return data.content;
    } catch {
      return null;
    }
  }
}
