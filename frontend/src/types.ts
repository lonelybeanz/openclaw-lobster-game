export type ApiResponse<T> = {
  code: number;
  data: T;
  message?: string;
};

export type MemberLevel = {
  id: number;
  name: string;
  level: number;
  experience: number;
  discountPercent: number;
  icon: string | null;
  backgroundUrl: string | null;
  status: number;
};

export type MemberUser = {
  id: number;
  mobile: string | null;
  nickname: string;
  levelId: number | null;
  experience: number;
  point: number;
  levelName: string | null;
  levelValue: number | null;
};

export type MemberSkill = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  required_level: number;
  required_experience: number;
  active: number;
};

export type UserSkill = MemberSkill & {
  unlock_source: string;
  unlocked_at: string;
};

export type ExperienceRecord = {
  id: number;
  user_id: number;
  biz_type: number;
  biz_id: string;
  title: string;
  description: string;
  experience: number;
  total_experience: number;
  created_at: string;
};

export type PageData<T> = {
  total: number;
  list: T[];
  pageNo: number;
  pageSize: number;
};

export type BizType = {
  type: number;
  title: string;
  add: boolean;
};

export type LobsterStats = {
  level: number;
  experience: number;
  maxExperience: number;
  age: number;
  hunger: number;
  intelligence: number;
  memory: number;
  skills: number;
  experiencePool: number;
  mood: number;
  fatigue: number;
  loyalty: number;
  totalTokens: number;
  totalSessions: number;
  totalMessages: number;
  lastActive: string;
};

export type LobsterNewsItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  url: string | null;
  publishedAt: string;
};
