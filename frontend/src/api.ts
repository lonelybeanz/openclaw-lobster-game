import type { InteractResult, LobsterNewsItem, SearchNewsResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/admin-api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message ?? '业务请求失败');
  }
  return json.data;
}

export async function getLobsterStats(): Promise<any> {
  return request('/lobster/stats');
}

export async function getLobsterNews(): Promise<LobsterNewsItem[]> {
  return request('/lobster/news');
}

export async function interact(action: 'feed' | 'train' | 'rest'): Promise<InteractResult> {
  return request('/lobster/interact', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function getAchievements(): Promise<any[]> {
  return request('/lobster/achievements');
}

export async function getTokenStats(): Promise<any> {
  return request('/lobster/tokens');
}

// 成长里程碑
export async function getMilestones(): Promise<any> {
  return request('/lobster/milestones');
}

// 主动关怀
export async function getCareMessage(): Promise<{ message: string | null }> {
  return request('/lobster/care');
}

// 深度对话 - 与 OpenClaw 互动
export async function deepTalk(message: string): Promise<any> {
  return request('/lobster/deeptalk', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// 搜索资讯 - 使用 OpenClaw 获取网上最新资讯
export async function searchNews(query: string, asyncMode = false): Promise<SearchNewsResponse> {
  return request('/lobster/search-news', {
    method: 'POST',
    body: JSON.stringify({ query, async: asyncMode }),
  });
}

// 获取搜索结果（轮询）
export async function getSearchResult(jobId: string): Promise<SearchNewsResponse> {
  return request(`/lobster/search-result/${jobId}`);
}
