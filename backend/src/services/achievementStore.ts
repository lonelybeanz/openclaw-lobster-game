import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export type AchievementCategory = 'milestone' | 'brain' | 'skill' | 'explore' | 'social' | 'journey';

export type AchievementCondition =
  | { type: 'first_meet' }
  | { type: 'exists'; stat: string }
  | { type: 'stat_gte'; stat: string; value: number };

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  order: number;
}

export interface AchievementUnlockRecord {
  achievementId: string;
  unlockedAt: string;
  statsAtUnlock: Record<string, unknown>;
}

export interface AchievementStoreData {
  version: string;
  updatedAt: string;
  definitions: AchievementDefinition[];
  unlocks: AchievementUnlockRecord[];
}

export interface AchievementView extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  max?: number;
  progressPercent?: number;
}

export interface AchievementContext {
  level?: number;
  age?: number;
  loyalty?: number;
  skills?: number;
  totalTokens?: number;
  totalSessions?: number;
  totalInteractions?: number;
  consecutiveDays?: number;
  firstMeet?: string;
  midnightCount?: number;
  deepTalkCount?: number;
  challengesCompleted?: number;
  lastFed?: string;
  lastTrained?: string;
  lastRested?: string;
  brain?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  [key: string]: unknown;
}

const ACHIEVEMENTS_FILE = fileURLToPath(new URL('../../data/achievements.json', import.meta.url));

const FALLBACK_STORE: AchievementStoreData = {
  version: '1.0',
  updatedAt: new Date().toISOString(),
  definitions: [],
  unlocks: [],
};

const LEGACY_UNLOCK_TIME_BY_ID: Record<string, string> = {
  first_meet: 'firstMeet',
  first_feed: 'lastFed',
  first_train: 'lastTrained',
  first_rest: 'lastRested',
};

let storeWriteQueue: Promise<void> = Promise.resolve();

function queueStoreWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = storeWriteQueue.then(task, task);
  storeWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureAchievementStoreFile(): Promise<void> {
  await mkdir(dirname(ACHIEVEMENTS_FILE), { recursive: true });
  try {
    await readFile(ACHIEVEMENTS_FILE, 'utf-8');
  } catch {
    await writeFile(ACHIEVEMENTS_FILE, JSON.stringify(FALLBACK_STORE, null, 2));
  }
}

async function readAchievementStore(): Promise<AchievementStoreData> {
  await ensureAchievementStoreFile();
  const raw = await readFile(ACHIEVEMENTS_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<AchievementStoreData>;
  return {
    version: typeof parsed.version === 'string' ? parsed.version : FALLBACK_STORE.version,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    definitions: Array.isArray(parsed.definitions) ? parsed.definitions as AchievementDefinition[] : [],
    unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks as AchievementUnlockRecord[] : [],
  };
}

async function writeAchievementStore(store: AchievementStoreData): Promise<void> {
  const nextStore: AchievementStoreData = {
    ...store,
    updatedAt: new Date().toISOString(),
    definitions: [...store.definitions].sort((a, b) => a.order - b.order),
    unlocks: [...store.unlocks].sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt)),
  };
  await writeFile(ACHIEVEMENTS_FILE, JSON.stringify(nextStore, null, 2));
}

function getStatValue(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function matchesCondition(definition: AchievementDefinition, context: AchievementContext): boolean {
  switch (definition.condition.type) {
    case 'first_meet':
      return Boolean(context.firstMeet);
    case 'exists':
      return Boolean(getStatValue(context, definition.condition.stat));
    case 'stat_gte':
      return toFiniteNumber(getStatValue(context, definition.condition.stat)) >= definition.condition.value;
    default:
      return false;
  }
}

function getProgress(definition: AchievementDefinition, context: AchievementContext, currentMatched: boolean) {
  switch (definition.condition.type) {
    case 'stat_gte': {
      const current = Math.max(0, toFiniteNumber(getStatValue(context, definition.condition.stat)));
      const max = Math.max(0, definition.condition.value);
      const progress = Math.min(current, max);
      return {
        progress,
        max,
        progressPercent: max > 0 ? Math.min(100, Math.round((progress / max) * 100)) : 0,
      };
    }
    case 'exists':
    case 'first_meet':
      return {
        progress: currentMatched ? 1 : 0,
        max: 1,
        progressPercent: currentMatched ? 100 : 0,
      };
    default:
      return {};
  }
}

function buildStatsAtUnlock(context: AchievementContext): Record<string, unknown> {
  return {
    level: toFiniteNumber(context.level),
    age: toFiniteNumber(context.age),
    interactions: toFiniteNumber(context.totalInteractions),
    sessions: toFiniteNumber(context.totalSessions),
    loyalty: toFiniteNumber(context.loyalty),
    skills: toFiniteNumber(context.skills),
    totalTokens: toFiniteNumber(context.totalTokens),
    consecutiveDays: toFiniteNumber(context.consecutiveDays),
    deepTalkCount: toFiniteNumber(context.deepTalkCount),
    midnightCount: toFiniteNumber(context.midnightCount),
    challengesCompleted: toFiniteNumber(context.challengesCompleted),
  };
}

function materializeAchievements(store: AchievementStoreData, context: AchievementContext): AchievementView[] {
  const unlockMap = new Map<string, AchievementUnlockRecord>();
  for (const item of store.unlocks) {
    if (!unlockMap.has(item.achievementId)) {
      unlockMap.set(item.achievementId, item);
    }
  }

  return [...store.definitions]
    .sort((a, b) => a.order - b.order)
    .map((definition) => {
      const unlock = unlockMap.get(definition.id);
      const currentMatched = Boolean(unlock) || matchesCondition(definition, context);
      return {
        ...definition,
        unlocked: Boolean(unlock),
        unlockedAt: unlock?.unlockedAt,
        ...getProgress(definition, context, currentMatched),
      };
    });
}

function legacyUnlockRecord(id: string, context: AchievementContext): AchievementUnlockRecord {
  const timeField = LEGACY_UNLOCK_TIME_BY_ID[id];
  const rawUnlockedAt = timeField ? getStatValue(context, timeField) : undefined;
  return {
    achievementId: id,
    unlockedAt: typeof rawUnlockedAt === 'string' ? rawUnlockedAt : new Date().toISOString(),
    statsAtUnlock: buildStatsAtUnlock(context),
  };
}

export async function migrateLegacyAchievements(legacyIds: string[], context: AchievementContext): Promise<void> {
  if (!Array.isArray(legacyIds) || legacyIds.length === 0) {
    return;
  }

  await queueStoreWrite(async () => {
    const store = await readAchievementStore();
    const knownIds = new Set(store.definitions.map((item) => item.id));
    const unlockedIds = new Set(store.unlocks.map((item) => item.achievementId));
    let changed = false;

    for (const id of legacyIds) {
      if (!id || !knownIds.has(id) || unlockedIds.has(id)) {
        continue;
      }
      store.unlocks.push(legacyUnlockRecord(id, context));
      unlockedIds.add(id);
      changed = true;
    }

    if (changed) {
      await writeAchievementStore(store);
    }
  });
}

export async function syncAchievementUnlocks(context: AchievementContext): Promise<AchievementView[]> {
  return queueStoreWrite(async () => {
    const store = await readAchievementStore();
    const unlockedIds = new Set(store.unlocks.map((item) => item.achievementId));
    let changed = false;

    for (const definition of store.definitions) {
      if (unlockedIds.has(definition.id) || !matchesCondition(definition, context)) {
        continue;
      }

      store.unlocks.push({
        achievementId: definition.id,
        unlockedAt: new Date().toISOString(),
        statsAtUnlock: buildStatsAtUnlock(context),
      });
      unlockedIds.add(definition.id);
      changed = true;
    }

    if (changed) {
      await writeAchievementStore(store);
    }

    return materializeAchievements(store, context);
  });
}

export async function getAchievementViews(context: AchievementContext): Promise<AchievementView[]> {
  const store = await readAchievementStore();
  return materializeAchievements(store, context);
}

export async function getAchievementUnlockHistory(): Promise<AchievementUnlockRecord[]> {
  const store = await readAchievementStore();
  return [...store.unlocks].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
}

export async function getAchievementStore(): Promise<AchievementStoreData> {
  const store = await readAchievementStore();
  return {
    version: store.version,
    updatedAt: store.updatedAt,
    definitions: [...store.definitions].sort((a, b) => a.order - b.order),
    unlocks: [...store.unlocks].sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)),
  };
}
