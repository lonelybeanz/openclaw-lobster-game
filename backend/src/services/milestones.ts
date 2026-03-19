import { spawn } from 'child_process';

const ACPX = '/Users/moltbot/.nvm/versions/node/v22.22.0/bin/acpx';
const MILESTONE_CACHE_FILE = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data/milestone-enhancements.json';

const ENV = {
  ...process.env,
  PATH: '/Users/moltbot/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin',
  HOME: '/Users/moltbot',
};

// 成长之路 - 合并里程碑 + 四大类成就系统

export type MilestoneCategory = 'milestone' | 'brain' | 'skill' | 'explore' | 'social' | 'journey';

export interface Milestone {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: MilestoneCategory;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  max?: number;
  progressPercent?: number;
}

export interface MilestoneCategoryGroup {
  key: MilestoneCategory;
  name: string;
  icon: string;
  description: string;
  total: number;
  unlocked: number;
  progressPercent: number;
  milestones: Milestone[];
}

export interface MilestoneStats {
  total: number;
  unlocked: number;
  progressPercent: number;
  milestones: Milestone[];
  categories: MilestoneCategoryGroup[];
}

export interface LobsterStats {
  totalInteractions: number;
  consecutiveDays: number;
  lastActiveDate: string;
  firstMeet?: string;
  midnightCount: number;
  deepTalkCount: number;
  challengesCompleted: number;
  skills?: number;
  age?: number;
  level?: number;
  brain?: {
    neurons?: number;
    longTerm?: number;
    procedural?: number;
  };
  memory?: {
    shallow?: { count?: number };
    deep?: { count?: number };
    organization?: number;
    overallScore?: number;
    indexedAgents?: number;
  };
}

// 分类元数据
const CATEGORY_META: Record<MilestoneCategory, { name: string; icon: string; description: string; order: number }> = {
  milestone: { name: '成长之路', icon: '🎯', description: '记录与小龙虾共同成长的每一步', order: 1 },
  brain: { name: '脑力', icon: '🧠', description: '聚焦智力、记忆与认知成长', order: 2 },
  skill: { name: '技能', icon: '🛠️', description: '记录技能数量与熟练度积累', order: 3 },
  explore: { name: '探索', icon: '🧭', description: '衡量记忆深度、索引覆盖与养成时长', order: 4 },
  social: { name: '社交', icon: '💬', description: '关注会话频率、互动密度与伙伴关系', order: 5 },
  journey: { name: '心路历程', icon: '🌟', description: 'LLM 动态生成的个性化成长卡片', order: 6 },
};

// 里程碑定义（原成长之路）
const MILESTONE_DEFINITIONS = [
  { id: 'first_meet', name: '初心萌动', desc: '首次相遇，开启养成之旅', icon: '👋', condition: (s: LobsterStats) => !!s.firstMeet },
  { id: 'consecutive_3', name: '三日之约', desc: '连续3天陪伴', icon: '🗓️', condition: (s: LobsterStats) => (s.consecutiveDays || 0) >= 3 },
  { id: 'consecutive_7', name: '一周伙伴', desc: '连续7天陪伴', icon: '🌟', condition: (s: LobsterStats) => (s.consecutiveDays || 0) >= 7 },
  { id: 'consecutive_14', name: '半月同频', desc: '连续14天陪伴', icon: '🧭', condition: (s: LobsterStats) => (s.consecutiveDays || 0) >= 14 },
  { id: 'talk_50', name: '话痨小龙虾', desc: '累计50次互动', icon: '💬', condition: (s: LobsterStats) => (s.totalInteractions || 0) >= 50 },
  { id: 'talk_100', name: '元老伙伴', desc: '累计100次互动', icon: '🏅', condition: (s: LobsterStats) => (s.totalInteractions || 0) >= 100 },
  { id: 'deep_talk_1', name: '灵智初开', desc: '首次深度对话', icon: '🧠', condition: (s: LobsterStats) => (s.deepTalkCount || 0) >= 1 },
  { id: 'deep_talk_5', name: '知心伙伴', desc: '累计5次深度对话', icon: '💡', condition: (s: LobsterStats) => (s.deepTalkCount || 0) >= 5 },
  { id: 'deep_talk_20', name: '心流共鸣', desc: '累计20次深度对话', icon: '🌌', condition: (s: LobsterStats) => (s.deepTalkCount || 0) >= 20 },
  { id: 'skills_10', name: '全技能掌握', desc: '解锁全部技能（10+）', icon: '🛠️', condition: (s: LobsterStats) => (s.skills || 0) >= 10 },
  { id: 'challenge_1', name: '进化之路', desc: '完成第一个挑战', icon: '🎯', condition: (s: LobsterStats) => (s.challengesCompleted || 0) >= 1 },
  { id: 'challenge_5', name: '挑战达人', desc: '完成5个挑战', icon: '⚔️', condition: (s: LobsterStats) => (s.challengesCompleted || 0) >= 5 },
  { id: 'midnight_1', name: '夜猫子', desc: '首次熬夜陪伴', icon: '🌙', condition: (s: LobsterStats) => (s.midnightCount || 0) >= 1 },
  { id: 'midnight_5', name: '深夜守护者', desc: '累计5次熬夜', icon: '🌃', condition: (s: LobsterStats) => (s.midnightCount || 0) >= 5 },
  { id: 'age_30', name: '一月游', desc: '陪伴30天', icon: '🗓️', condition: (s: LobsterStats) => (s.age || 0) >= 30 },
];

// 成就定义（四大类）
const ACHIEVEMENT_DEFINITIONS = [
  // 脑力类
  { id: 'brain_neurons_100', name: '最强大脑', desc: '神经元达到 100', icon: '🧠', category: 'brain' as MilestoneCategory, max: 100, progress: (s: LobsterStats) => s.brain?.neurons || 0 },
  { id: 'brain_long_term_80', name: '记忆超群', desc: '长期记忆达到 80', icon: '💾', category: 'brain' as MilestoneCategory, max: 80, progress: (s: LobsterStats) => s.brain?.longTerm || 0 },
  { id: 'brain_memory_org_80', name: '井井有条', desc: '记忆组织度达到 80', icon: '📚', category: 'brain' as MilestoneCategory, max: 80, progress: (s: LobsterStats) => s.memory?.organization || 0 },

  // 技能类
  { id: 'skill_3', name: '三板斧', desc: '拥有 3 个技能', icon: '🪓', category: 'skill' as MilestoneCategory, max: 3, progress: (s: LobsterStats) => s.skills || 0 },
  { id: 'skill_10', name: '十项全能', desc: '拥有 10 个技能', icon: '🏆', category: 'skill' as MilestoneCategory, max: 10, progress: (s: LobsterStats) => s.skills || 0 },
  { id: 'skill_level_10', name: '熟练进化', desc: '等级达到 10', icon: '🐉', category: 'skill' as MilestoneCategory, max: 10, progress: (s: LobsterStats) => s.level || 0 },

  // 探索类
  { id: 'explore_age_7', name: '一周目', desc: '陪伴满 7 天', icon: '📅', category: 'explore' as MilestoneCategory, max: 7, progress: (s: LobsterStats) => s.age || 0 },
  { id: 'explore_age_30', name: '一月游', desc: '陪伴满 30 天', icon: '🗓️', category: 'explore' as MilestoneCategory, max: 30, progress: (s: LobsterStats) => s.age || 0 },
  { id: 'explore_night_5', name: '深夜守护者', desc: '累计 5 次深夜陪伴', icon: '🌃', category: 'explore' as MilestoneCategory, max: 5, progress: (s: LobsterStats) => s.midnightCount || 0 },

  // 社交类
  { id: 'social_sessions_10', name: '社交达人', desc: '完成 10 次会话', icon: '💬', category: 'social' as MilestoneCategory, max: 10, progress: (s: LobsterStats) => s.totalInteractions || 0 },
  { id: 'social_interactions_50', name: '话痨小龙虾', desc: '累计 50 次互动', icon: '🗣️', category: 'social' as MilestoneCategory, max: 50, progress: (s: LobsterStats) => s.totalInteractions || 0 },
  { id: 'social_deep_talk_5', name: '知心伙伴', desc: '累计 5 次深度对话', icon: '✨', category: 'social' as MilestoneCategory, max: 5, progress: (s: LobsterStats) => s.deepTalkCount || 0 },
];

function clampProgress(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= max) return max;
  return value;
}

function toPercent(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.round((clampProgress(value, max) / max) * 100));
}

export async function getMilestones(
  stats: any,
  milestoneStats: LobsterStats,
  llmMilestones?: Array<{
    id: string;
    name: string;
    description: string;
    icon?: string;
    unlocked?: boolean;
    progress?: number;
    maxProgress?: number;
  }>
): Promise<MilestoneStats> {
  const mergedStats: LobsterStats = { ...stats, ...milestoneStats };
  const milestones: Milestone[] = [];
  const unlockedAt = new Date().toISOString();

  // 1. 处理原成长之路里程碑
  for (const m of MILESTONE_DEFINITIONS) {
    const isUnlocked = m.condition(mergedStats);
    if (isUnlocked) {
      milestones.push({
        id: m.id,
        name: m.name,
        description: m.desc,
        icon: m.icon,
        category: 'milestone',
        unlocked: true,
        unlockedAt,
      });
    }
  }

  // 2. 处理四大类成就
  for (const ach of ACHIEVEMENT_DEFINITIONS) {
    const currentValue = Math.max(0, ach.progress(mergedStats));
    const isUnlocked = currentValue >= ach.max;
    const progress = clampProgress(currentValue, ach.max);

    milestones.push({
      id: ach.id,
      name: ach.name,
      description: ach.desc,
      icon: ach.icon,
      category: ach.category,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? unlockedAt : undefined,
      progress,
      max: ach.max,
      progressPercent: toPercent(currentValue, ach.max),
    });
  }

  // 3. 添加 LLM 动态成就（心路历程）
  if (llmMilestones && llmMilestones.length > 0) {
    for (const card of llmMilestones) {
      milestones.push({
        id: `llm-${card.id}`,
        name: `${card.icon || '🌟'} ${card.name}`,
        description: card.description,
        icon: card.icon || '🌟',
        category: 'journey',
        unlocked: card.unlocked ?? true,
        unlockedAt: card.unlocked ? unlockedAt : undefined,
        progress: card.progress,
        max: card.maxProgress,
        progressPercent: card.maxProgress ? toPercent(card.progress || 0, card.maxProgress) : 100,
      });
    }
  }

  // 4. 按分类分组
  const categories: MilestoneCategoryGroup[] = (Object.keys(CATEGORY_META) as MilestoneCategory[])
    .map((key) => {
      const meta = CATEGORY_META[key];
      const categoryMilestones = milestones.filter((m) => m.category === key);
      const unlocked = categoryMilestones.filter((m) => m.unlocked).length;
      const total = categoryMilestones.length;

      return {
        key,
        name: meta.name,
        icon: meta.icon,
        description: meta.description,
        total,
        unlocked,
        progressPercent: total > 0 ? Math.round((unlocked / total) * 100) : 0,
        milestones: categoryMilestones,
      };
    })
    .sort((a, b) => CATEGORY_META[a.key].order - CATEGORY_META[b.key].order);

  const total = milestones.length;
  const unlocked = milestones.filter((m) => m.unlocked).length;

  return {
    total,
    unlocked,
    progressPercent: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    milestones,
    categories,
  };
}

export function generateCareMessage(stats: any): string | null {
  const { hunger, fatigue, mood, totalInteractions } = stats;

  if (!totalInteractions || totalInteractions < 5) {
    return '你好呀！我是小龙虾🦞，以后请多指教~';
  }

  if (hunger < 30) {
    const messages = ['肚子好饿啊...今天还没吃饭呢', '饿死啦饿死啦！', '有吃的吗？饿得睡不着...'];
    return messages[Math.floor(Math.random() * messages.length)] ?? null;
  }

  if (fatigue > 80) {
    const messages = ['今天陪我玩了好久...好累啊', '脑子转不动了，想休息一下', '呜呜，好困...'];
    return messages[Math.floor(Math.random() * messages.length)] ?? null;
  }

  if (mood > 70 && Math.random() < 0.1) {
    const messages = ['和你在一起的每一天都在成长！', '今天心情特别好！因为有你~', '嘿嘿，想到你就开心！'];
    return messages[Math.floor(Math.random() * messages.length)] ?? null;
  }

  return null;
}

export async function enhanceMilestones(): Promise<Record<string, string>> {
  try {
    const output = await execFile(ACPX, ['codex', 'sessions', 'list'], { env: ENV });
    // 简单处理，实际可以接入 AI 增强描述
    return {};
  } catch {
    return {};
  }
}

function execFile(command: string, args: string[], options: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => { stdout += data; });
    child.stderr?.on('data', (data) => { stderr += data; });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
  });
}
