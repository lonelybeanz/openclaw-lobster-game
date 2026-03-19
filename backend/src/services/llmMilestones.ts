import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getCompleteLobsterStats } from './complete';
import { runOpenClawAgentPrompt } from './openclaw';
import { loadLobsterState } from './persistence';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(SERVICE_DIR, '../../data/llm-milestones.json');

type DimensionId =
  | 'growth'
  | 'brain'
  | 'skills'
  | 'exploration'
  | 'social'
  | 'flow'
  | 'guardian'
  | 'evolution';

type CardLevel = 'bronze' | 'silver' | 'gold' | 'mythic';

type Snapshot = {
  id: DimensionId;
  category: string;
  icon: string;
  score: number;
  value: number;
  target: number;
  metricLabel: string;
  metricValue: string;
  unlocked: boolean;
};

type LlmNarrative = {
  summary: string;
  cards: Array<{
    id: DimensionId;
    name: string;
    headline: string;
    description: string;
    nextHint: string;
  }>;
};

type PersistedPayload = {
  generatedAt: string;
  expiresAt: string;
  source: 'fresh' | 'cache' | 'stale-cache' | 'fallback';
  summary: string;
  cards: LlmMilestoneCard[];
};

export type LlmMilestoneCard = {
  id: DimensionId;
  category: string;
  icon: string;
  name: string;
  headline: string;
  description: string;
  nextHint: string;
  level: CardLevel;
  score: number;
  progress: number;
  maxProgress: number;
  progressText: string;
  unlocked: boolean;
  metricLabel: string;
  metricValue: string;
};

export type LlmMilestonesResponse = PersistedPayload;

let memoryCache: PersistedPayload | null = null;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function levelFromScore(score: number): CardLevel {
  if (score >= 90) return 'mythic';
  if (score >= 75) return 'gold';
  if (score >= 55) return 'silver';
  return 'bronze';
}

function buildSnapshots(stats: Awaited<ReturnType<typeof getCompleteLobsterStats>>, state: Awaited<ReturnType<typeof loadLobsterState>>): Snapshot[] {
  const interactionCount = state.totalInteractions || 0;
  const explorationValue = stats.totalSessions + stats.totalMessages;
  const guardianValue = (state.midnightCount || 0) * 15 + (state.consecutiveDays || 0) * 5 + Math.floor(stats.loyalty / 4);

  return [
    {
      id: 'growth',
      category: '成长',
      icon: '🌱',
      score: clamp((state.consecutiveDays || 0) * 12 + interactionCount * 0.35),
      value: Math.min(interactionCount, 100),
      target: 100,
      metricLabel: '累计互动',
      metricValue: `${interactionCount} 次`,
      unlocked: interactionCount >= 5,
    },
    {
      id: 'brain',
      category: '脑力',
      icon: '🧠',
      score: clamp(stats.intelligence),
      value: clamp(stats.intelligence),
      target: 100,
      metricLabel: '智能指数',
      metricValue: `${Math.round(stats.intelligence)}`,
      unlocked: stats.intelligence >= 40,
    },
    {
      id: 'skills',
      category: '技能',
      icon: '🛠️',
      score: clamp((stats.skills || 0) * 10),
      value: Math.min(stats.skills || 0, 10),
      target: 10,
      metricLabel: '技能数量',
      metricValue: `${stats.skills || 0} 项`,
      unlocked: (stats.skills || 0) >= 3,
    },
    {
      id: 'exploration',
      category: '探索',
      icon: '🧭',
      score: clamp(stats.totalSessions * 4 + Math.min(stats.totalMessages / 5, 40)),
      value: Math.min(explorationValue, 120),
      target: 120,
      metricLabel: '会话探索',
      metricValue: `${stats.totalSessions} 会话 / ${stats.totalMessages} 消息`,
      unlocked: stats.totalSessions >= 3,
    },
    {
      id: 'social',
      category: '社交',
      icon: '🤝',
      score: clamp((stats.loyalty || 0) * 0.65 + (state.deepTalkCount || 0) * 4),
      value: Math.min((state.deepTalkCount || 0) * 10 + Math.round(stats.loyalty || 0), 150),
      target: 150,
      metricLabel: '亲密度',
      metricValue: `忠诚 ${stats.loyalty} / 深聊 ${state.deepTalkCount || 0}`,
      unlocked: (state.deepTalkCount || 0) >= 1 || (stats.loyalty || 0) >= 60,
    },
    {
      id: 'flow',
      category: '心流',
      icon: '🌊',
      score: clamp((state.deepTalkCount || 0) * 8 + (stats.mood || 0) * 0.45 + (100 - (stats.fatigue || 0)) * 0.2),
      value: Math.min((state.deepTalkCount || 0) * 5 + Math.round(stats.mood || 0), 120),
      target: 120,
      metricLabel: '深聊与心情',
      metricValue: `深聊 ${state.deepTalkCount || 0} / 心情 ${stats.mood}`,
      unlocked: (state.deepTalkCount || 0) >= 3,
    },
    {
      id: 'guardian',
      category: '守护者',
      icon: '🛡️',
      score: clamp(guardianValue),
      value: Math.min(guardianValue, 100),
      target: 100,
      metricLabel: '陪伴守护',
      metricValue: `连击 ${state.consecutiveDays || 0} 天 / 深夜 ${state.midnightCount || 0} 次`,
      unlocked: (state.consecutiveDays || 0) >= 7 || (state.midnightCount || 0) >= 2,
    },
    {
      id: 'evolution',
      category: '进化',
      icon: '🧬',
      score: clamp(stats.level * 12 + Math.min(stats.experiencePool / 2000, 35) + (stats.memoryScore || 0) * 0.3),
      value: Math.min(stats.level * 10 + Math.round((stats.memoryScore || 0) / 2), 150),
      target: 150,
      metricLabel: '等级与记忆',
      metricValue: `Lv.${stats.level} / 记忆 ${Math.round(stats.memoryScore || 0)}`,
      unlocked: stats.level >= 3 || (stats.memoryScore || 0) >= 60,
    },
  ];
}

const FALLBACK_COPY: Record<DimensionId, { name: string; headline: string; description: string; nextHint: string }> = {
  growth: {
    name: '成长轨迹',
    headline: '每一次互动都在塑造新的阶段',
    description: '从初见到稳定陪伴，小龙虾正在把零散互动沉淀成连续成长。',
    nextHint: '继续保持互动节奏，让成长卡从萌芽跨进稳定期。',
  },
  brain: {
    name: '脑力回路',
    headline: '思考能力已经形成可见轮廓',
    description: '模型智力、上下文和记忆结构一起决定了这张脑力卡的厚度。',
    nextHint: '继续积累会话和记忆，让脑力卡突破下一段位。',
  },
  skills: {
    name: '技能图谱',
    headline: '技能点正在从单点解锁走向体系化',
    description: '掌握的技能越多，越能支撑更复杂的工作流和更稳定的输出。',
    nextHint: '补足技能短板，技能卡会更接近完整图谱。',
  },
  exploration: {
    name: '探索航线',
    headline: '会话轨迹正在扩展边界',
    description: '每一次新主题、新任务和新消息都在为探索维度增加地图面积。',
    nextHint: '继续开启新话题和任务，让探索航线更长。',
  },
  social: {
    name: '社交共振',
    headline: '陪伴感已经开始形成稳定反馈',
    description: '忠诚度和深度对话共同构成关系温度，决定这张社交卡的亮度。',
    nextHint: '多一些深聊和高质量互动，社交共振会更强。',
  },
  flow: {
    name: '心流瞬间',
    headline: '专注与默契正在同步抬升',
    description: '当心情、疲劳和深聊频次形成平衡时，心流卡会进入更顺滑的状态。',
    nextHint: '保持心情和深聊节奏，心流会更容易出现。',
  },
  guardian: {
    name: '守护者印记',
    headline: '稳定陪伴正在被系统识别为守护行为',
    description: '连续天数、深夜陪伴和忠诚度，都会把守护者维度推向更高等级。',
    nextHint: '再多几次稳定陪伴，这张卡会更有守护者气质。',
  },
  evolution: {
    name: '进化分形',
    headline: '等级、经验和记忆正在共同推动进化',
    description: '进化不是单一指标，而是能力、经验和记忆长期叠加后的结果。',
    nextHint: '继续积累经验与记忆，进化卡会解锁更高形态。',
  },
};

function buildFallbackNarrative(snapshots: Snapshot[]): LlmNarrative {
  return {
    summary: `当前共生成 ${snapshots.length} 张动态成就卡，覆盖成长、脑力、技能、探索、社交、心流、守护者与进化八个维度。`,
    cards: snapshots.map((snapshot) => ({
      id: snapshot.id,
      ...FALLBACK_COPY[snapshot.id],
    })),
  };
}

function buildPrompt(snapshots: Snapshot[]) {
  return `你是一个养成游戏的成就系统设计师。请根据数据为小龙虾生成“动态成就卡片”文案。

要求：
1. 只返回 JSON，不要 markdown，不要解释。
2. 返回格式：
{
  "summary": "一句总述，40字内",
  "cards": [
    {
      "id": "growth",
      "name": "4-8字卡片名",
      "headline": "12-24字短句",
      "description": "20-50字描述",
      "nextHint": "12-30字下一步建议"
    }
  ]
}
3. cards 必须覆盖且仅覆盖这些 id：growth, brain, skills, exploration, social, flow, guardian, evolution。
4. 风格：灵动、游戏化、偏成长叙事，不要夸张，不要自称 AI，不要杜撰未给出的数字。

当前维度数据：
${JSON.stringify(snapshots, null, 2)}`;
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const match = raw.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

function parseNarrative(raw: string, snapshots: Snapshot[]): LlmNarrative | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<LlmNarrative>;
    if (!Array.isArray(parsed.cards)) {
      return null;
    }

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : buildFallbackNarrative(snapshots).summary,
      cards: snapshots.map((snapshot) => {
        const match = parsed.cards?.find((item) => item?.id === snapshot.id);
        const fallback = FALLBACK_COPY[snapshot.id];
        return {
          id: snapshot.id,
          name: typeof match?.name === 'string' && match.name.trim() ? match.name.trim() : fallback.name,
          headline: typeof match?.headline === 'string' && match.headline.trim() ? match.headline.trim() : fallback.headline,
          description: typeof match?.description === 'string' && match.description.trim() ? match.description.trim() : fallback.description,
          nextHint: typeof match?.nextHint === 'string' && match.nextHint.trim() ? match.nextHint.trim() : fallback.nextHint,
        };
      }),
    };
  } catch {
    return null;
  }
}

function mergeCards(snapshots: Snapshot[], narrative: LlmNarrative): LlmMilestoneCard[] {
  return snapshots.map((snapshot) => {
    const card = narrative.cards.find((item) => item.id === snapshot.id) || { id: snapshot.id, ...FALLBACK_COPY[snapshot.id] };
    return {
      id: snapshot.id,
      category: snapshot.category,
      icon: snapshot.icon,
      name: card.name,
      headline: card.headline,
      description: card.description,
      nextHint: card.nextHint,
      level: levelFromScore(snapshot.score),
      score: Math.round(snapshot.score),
      progress: snapshot.value,
      maxProgress: snapshot.target,
      progressText: `${snapshot.value}/${snapshot.target}`,
      unlocked: snapshot.unlocked,
      metricLabel: snapshot.metricLabel,
      metricValue: snapshot.metricValue,
    };
  });
}

async function ensureCacheDir() {
  await mkdir(dirname(CACHE_FILE), { recursive: true });
}

async function readCacheFile(): Promise<PersistedPayload | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(content) as PersistedPayload;
    if (!parsed || !Array.isArray(parsed.cards) || typeof parsed.generatedAt !== 'string' || typeof parsed.expiresAt !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCacheFile(payload: PersistedPayload) {
  await ensureCacheDir();
  await writeFile(CACHE_FILE, JSON.stringify(payload, null, 2));
}

function isFresh(payload: PersistedPayload) {
  return new Date(payload.expiresAt).getTime() > Date.now();
}

async function generateFreshPayload(): Promise<PersistedPayload> {
  const [stats, state] = await Promise.all([getCompleteLobsterStats(), loadLobsterState()]);
  const snapshots = buildSnapshots(stats, state);
  const fallbackNarrative = buildFallbackNarrative(snapshots);

  let narrative = fallbackNarrative;
  let source: PersistedPayload['source'] = 'fallback';

  try {
    const raw = await runOpenClawAgentPrompt(buildPrompt(snapshots), 90000, 'lobster');
    const parsed = parseNarrative(raw, snapshots);
    if (parsed) {
      narrative = parsed;
      source = 'fresh';
    }
  } catch (error) {
    console.error('[llmMilestones] llm generation failed:', error);
  }

  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    source,
    summary: narrative.summary,
    cards: mergeCards(snapshots, narrative),
  };
}

export async function getLlmMilestones(force = false): Promise<LlmMilestonesResponse> {
  if (!force && memoryCache && isFresh(memoryCache)) {
    return { ...memoryCache, source: 'cache' };
  }

  const cached = await readCacheFile();
  if (!force && cached && isFresh(cached)) {
    memoryCache = cached;
    return { ...cached, source: 'cache' };
  }

  try {
    const payload = await generateFreshPayload();
    memoryCache = payload;
    await writeCacheFile(payload);
    return payload;
  } catch (error) {
    console.error('[llmMilestones] build failed:', error);
    if (cached) {
      memoryCache = cached;
      return { ...cached, source: 'stale-cache' };
    }
    throw error;
  }
}
