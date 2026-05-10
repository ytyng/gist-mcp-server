// GitHub Gist API クライアント

export interface GistFile {
  filename: string;
  content: string;
  type?: string;
}

export interface CreateGistInput {
  description?: string;
  public?: boolean;
  files: Record<string, { content: string }>;
}

export interface Gist {
  id: string;
  url: string;
  html_url: string;
  files: Record<string, {
    filename: string;
    type: string;
    language: string | null;
    raw_url: string;
    size: number;
    content?: string;
  }>;
  public: boolean;
  created_at: string;
  updated_at: string;
  description: string | null;
  comments: number;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
}

export interface UpdateGistInput {
  description?: string;
  files?: Record<string, { content?: string; filename?: string } | null>;
}

export interface GistComment {
  id: number;
  url: string;
  body: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

class GistAPIError extends Error {
  constructor(public status: number, message: string, public response?: unknown) {
    super(message);
    this.name = 'GistAPIError';
  }
}

export class GistClient {
  private baseUrl = 'https://api.github.com';
  private token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error('GitHub トークンが設定されていません');
    }
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const message = responseData?.message || `HTTP ${response.status}`;
        throw new GistAPIError(response.status, message, responseData);
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof GistAPIError) {
        throw error;
      }
      throw new Error(`ネットワークエラー: ${error}`);
    }
  }

  // Gist を作成
  async createGist(input: CreateGistInput): Promise<Gist> {
    const payload = {
      description: input.description || '',
      public: input.public ?? false,
      files: input.files,
    };

    return await this.request<Gist>('/gists', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Gist を取得
  async getGist(gistId: string): Promise<Gist> {
    return await this.request<Gist>(`/gists/${gistId}`);
  }

  // Gist を更新
  async updateGist(gistId: string, input: UpdateGistInput): Promise<Gist> {
    return await this.request<Gist>(`/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // Gist を削除
  async deleteGist(gistId: string): Promise<void> {
    await this.request(`/gists/${gistId}`, {
      method: 'DELETE',
    });
  }

  // ユーザーの Gist 一覧を取得
  async listGists(username?: string, options?: {
    per_page?: number;
    page?: number;
    since?: string;
  }): Promise<Gist[]> {
    const params = new URLSearchParams();
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.since) params.append('since', options.since);

    const path = username
      ? `/users/${username}/gists`
      : '/gists';

    const query = params.toString();
    const url = query ? `${path}?${query}` : path;

    return await this.request<Gist[]>(url);
  }

  // 全ページの Gist を取得 (ページネーションを内部で処理)
  async listAllGists(username?: string, options?: {
    since?: string;
    per_page?: number;
  }): Promise<Gist[]> {
    // GitHub API の per_page 仕様 (1-100) を超えた値は無限ループや想定外の挙動を招くのでクランプ
    const requested = options?.per_page ?? 100;
    const perPage = Math.min(100, Math.max(1, Math.floor(requested)));
    const all: Gist[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.listGists(username, {
        per_page: perPage,
        page,
        since: options?.since,
      });
      all.push(...batch);
      // 空応答は最終ページ。batch.length === perPage の場合のみ次ページを試す
      if (batch.length === 0 || batch.length < perPage) break;
    }
    return all;
  }

  // Gist にスターを付ける
  async starGist(gistId: string): Promise<void> {
    await this.request(`/gists/${gistId}/star`, {
      method: 'PUT',
    });
  }

  // Gist のスターを外す
  async unstarGist(gistId: string): Promise<void> {
    await this.request(`/gists/${gistId}/star`, {
      method: 'DELETE',
    });
  }

  // Gist がスターされているか確認
  async isGistStarred(gistId: string): Promise<boolean> {
    try {
      await this.request(`/gists/${gistId}/star`, {
        method: 'GET',
      });
      return true;
    } catch (error) {
      if (error instanceof GistAPIError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  // Gist をフォーク
  async forkGist(gistId: string): Promise<Gist> {
    return await this.request<Gist>(`/gists/${gistId}/forks`, {
      method: 'POST',
    });
  }

  // Gist のコメント一覧を取得
  async listGistComments(gistId: string): Promise<GistComment[]> {
    return await this.request<GistComment[]>(`/gists/${gistId}/comments`);
  }

  // Gist にコメントを追加
  async createGistComment(gistId: string, body: string): Promise<GistComment> {
    return await this.request<GistComment>(`/gists/${gistId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }


  // 複数ファイルを含む Gist を作成
  async createMultiFileGist(
    description: string,
    files: GistFile[],
    isPublic: boolean = false
  ): Promise<Gist> {
    const gistFiles: Record<string, { content: string }> = {};
    
    for (const file of files) {
      gistFiles[file.filename] = { content: file.content };
    }

    return await this.createGist({
      description,
      public: isPublic,
      files: gistFiles,
    });
  }
}

// 可視性フィルター: secret(=private), public, all
export type GistVisibility = "secret" | "public" | "all";

export function filterByVisibility(gists: Gist[], visibility: GistVisibility): Gist[] {
  if (visibility === "all") return gists;
  if (visibility === "secret") return gists.filter((g) => !g.public);
  return gists.filter((g) => g.public);
}

// 指定日数以上前に作成された Gist のみを返す (created_at 基準、inclusive)
// 「N日以上前」= now - created >= N日 → created <= now - N日
export function filterOlderThanDays(gists: Gist[], days: number, now: Date = new Date()): Gist[] {
  const thresholdMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return gists.filter((g) => new Date(g.created_at).getTime() <= thresholdMs);
}

// ヘルパー関数
export function formatGistUrl(gist: Gist): string {
  return gist.html_url;
}

export function getGistRawUrl(gist: Gist, filename: string): string | null {
  const file = gist.files[filename];
  return file?.raw_url || null;
}

export function formatGistInfo(gist: Gist): string {
  const files = Object.keys(gist.files).join(', ');
  const visibility = gist.public ? 'Public' : 'Private';
  const owner = gist.owner?.login || 'Anonymous';
  
  return `Gist ID: ${gist.id}
Description: ${gist.description || 'No description'}
Owner: ${owner}
Visibility: ${visibility}
Files: ${files}
Created: ${new Date(gist.created_at).toLocaleString('ja-JP')}
Updated: ${new Date(gist.updated_at).toLocaleString('ja-JP')}
URL: ${gist.html_url}`;
}