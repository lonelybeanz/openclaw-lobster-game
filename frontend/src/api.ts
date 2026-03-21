import type {
  AchievementUnlockHistoryItem,
  InteractResult,
  LobsterNewsItem,
  MemoryLlmEvalResponse,
  MemoryLlmEvalSavedRecord,
  MemoryScoreSnapshot,
  LlmMilestonesResponse,
  SearchNewsResponse,
  VisualizationSnapshot,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/admin-api';

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export class RequestTimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs;
  const timeoutId =
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new RequestTimeoutError(typeof timeoutMs === 'number' ? `请求超时（>${Math.round(timeoutMs / 1000)}s）` : '请求超时');
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message ?? '业务请求失败');
  }

  return json.data;
}

async function postJson<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body' | 'method'>): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'POST',
    headers: {
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

export async function getLobsterStats(): Promise<any> {
  return request('/lobster/stats');
}

export async function getLobsterNews(): Promise<LobsterNewsItem[]> {
  return request('/lobster/news');
}

export async function interact(action: 'feed' | 'train' | 'rest'): Promise<InteractResult> {
  return postJson('/lobster/interact', { action });
}

export async function getAchievements(): Promise<any[]> {
  return request('/lobster/achievements');
}

export async function getAchievementUnlockHistory(): Promise<AchievementUnlockHistoryItem[]> {
  return request('/lobster/achievement-unlock-history');
}

export async function getSkills(): Promise<any> {
  return request('/lobster/skills');
}

export async function getTokenStats(): Promise<any> {
  return request('/lobster/tokens');
}

export async function getMilestones(): Promise<any> {
  return request('/lobster/milestones');
}

export async function getLlmMilestones(): Promise<LlmMilestonesResponse> {
  return request('/lobster/llm-milestones');
}

export async function getCareMessage(): Promise<{ message: string | null }> {
  return request('/lobster/care');
}

export async function deepTalk(message: string): Promise<any> {
  return postJson('/lobster/deeptalk', { message });
}

export async function searchNews(query: string, asyncMode = false, timeoutMs?: number): Promise<SearchNewsResponse> {
  return postJson('/lobster/search-news', { query, async: asyncMode }, { timeoutMs });
}

export async function getSearchResult(jobId: string, timeoutMs?: number): Promise<SearchNewsResponse> {
  return request(`/lobster/search-result/${jobId}`, { timeoutMs });
}

export async function getMemoryScore(force = false): Promise<MemoryScoreSnapshot> {
  const suffix = force ? '?force=1' : '';
  return request(`/lobster/memory-score${suffix}`);
}

export async function getMemoryLlmEval(): Promise<MemoryLlmEvalResponse> {
  return request('/lobster/memory-llm-eval');
}

export async function saveMemoryLlmEval(result: MemoryLlmEvalResponse): Promise<MemoryLlmEvalSavedRecord> {
  return postJson('/lobster/memory-llm-eval/save', { result });
}

// 可视化快照
export async function getVisualizationSnapshot(): Promise<VisualizationSnapshot> {
  return request('/lobster/visualization');
}
