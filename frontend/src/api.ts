import type {
  ApiResponse,
  ExperienceRecord,
  LobsterStats,
  LobsterNewsItem,
  MemberLevel,
  MemberSkill,
  MemberUser,
  PageData,
  UserSkill,
} from './types';

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

  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.message ?? '业务请求失败');
  }
  return json.data;
}

export function createUser(payload: { nickname: string; mobile?: string }) {
  return request<MemberUser>('/member/user/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getUser(id: number) {
  return request<MemberUser | null>(`/member/user/get?id=${id}`);
}

export function listLevels() {
  return request<MemberLevel[]>('/member/level/list?status=1');
}

export function listSkills() {
  return request<MemberSkill[]>('/member/skill/list');
}

export function getUserSkills(userId: number) {
  return request<UserSkill[]>(`/member/user/skills?userId=${userId}`);
}

export function addExperience(payload: { userId: number; experience: number; bizType: number; bizId: string }) {
  return request('/member/experience/add', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reduceExperience(payload: { userId: number; experience: number; bizType: number; bizId: string }) {
  return request('/member/experience/reduce', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function learnSkill(payload: { userId: number; skillId: number; source?: string }) {
  return request<UserSkill[]>('/member/skill/learn', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getExperienceRecords(params: { pageNo: number; pageSize: number; userId: number }) {
  return request<PageData<ExperienceRecord>>(
    `/member/experience-record/page?pageNo=${params.pageNo}&pageSize=${params.pageSize}&userId=${params.userId}`,
  );
}

export function getLobsterStats() {
  return request<LobsterStats>('/lobster/stats');
}

export function getLobsterNews() {
  return request<LobsterNewsItem[]>('/lobster/news');
}
