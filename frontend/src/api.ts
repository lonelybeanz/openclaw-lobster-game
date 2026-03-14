import type { InteractResult } from './types';

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

export async function getLobsterNews(): Promise<any[]> {
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
