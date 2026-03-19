import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { getCompleteLobsterStats } from './complete';
import { loadLobsterState } from './persistence';
import { getAchievements } from './achievements';
import type { Brain } from './lobster';

const DATA_DIR = process.env.LOBSTER_GAME_DATA_DIR ?? resolve(process.cwd(), '..', 'data');
const SNAPSHOT_STORE_FILE = resolve(DATA_DIR, 'lobster-snapshots.json');
const MAX_HISTORY_DAYS = 365;
const SCHEDULER_CHECK_INTERVAL_MS = 60 * 60 * 1000;

type SnapshotStats = {
  level: number;
  experience: number;
  hunger: number;
  mood: number;
  fatigue: number;
  health: number;
  loyalty: number;
  totalTokens: number;
  totalSessions: number;
  totalInteractions: number;
  age: number;
};

type SnapshotAchievements = {
  total: number;
  unlocked: number;
  newlyUnlocked: string[];
  unlockedIds: string[];
};

export interface LobsterSnapshot {
  date: string;
  generatedAt: string;
  stats: SnapshotStats;
  brain: Brain;
  achievements: SnapshotAchievements;
}

export interface SnapshotDiff {
  date: string;
  previousDate: string | null;
  generatedAt: string;
  levelDelta: number;
  experienceDelta: number;
  hungerDelta: number;
  moodDelta: number;
  fatigueDelta: number;
  healthDelta: number;
  loyaltyDelta: number;
  totalTokensDelta: number;
  totalSessionsDelta: number;
  totalInteractionsDelta: number;
  ageDelta: number;
  brain: Record<keyof Brain, number>;
  achievements: {
    unlockedDelta: number;
    newlyUnlocked: string[];
    lostUnlocked: string[];
  };
}

type SnapshotStore = {
  updatedAt: string | null;
  latest: LobsterSnapshot | null;
  history: LobsterSnapshot[];
};

type SaveDailySnapshotResult = {
  snapshot: LobsterSnapshot;
  diff: SnapshotDiff | null;
  created: boolean;
};

let schedulerStarted = false;

function emptyStore(): SnapshotStore {
  return {
    updatedAt: null,
    latest: null,
    history: [],
  };
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function calculateStableHealth(input: { hunger: number; mood: number; fatigue: number; loyalty: number }) {
  const score =
    input.hunger * 0.3 +
    input.mood * 0.25 +
    (100 - input.fatigue) * 0.3 +
    input.loyalty * 0.15;
  return clamp(Math.round(score));
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<SnapshotStore> {
  try {
    await ensureDataDir();
    const raw = await readFile(SNAPSHOT_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SnapshotStore>;
    const history = Array.isArray(parsed.history) ? parsed.history : [];
    const latest = parsed.latest && typeof parsed.latest === 'object' ? parsed.latest : history[history.length - 1] ?? null;
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : latest?.generatedAt ?? null,
      latest,
      history,
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: SnapshotStore) {
  await ensureDataDir();
  await writeFile(SNAPSHOT_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function normalizeSnapshot(snapshot: LobsterSnapshot): LobsterSnapshot {
  const unlockedIds = Array.isArray(snapshot.achievements?.unlockedIds) ? snapshot.achievements.unlockedIds : [];
  return {
    ...snapshot,
    achievements: {
      total: Number(snapshot.achievements?.total ?? 0),
      unlocked: Number(snapshot.achievements?.unlocked ?? 0),
      newlyUnlocked: Array.isArray(snapshot.achievements?.newlyUnlocked) ? snapshot.achievements.newlyUnlocked : [],
      unlockedIds,
    },
  };
}

function toComparableSnapshot(snapshot: LobsterSnapshot) {
  return normalizeSnapshot(snapshot);
}

async function buildSnapshot(date = formatLocalDate()): Promise<LobsterSnapshot> {
  const [stats, lobsterState, store] = await Promise.all([
    getCompleteLobsterStats(),
    loadLobsterState(),
    readStore(),
  ]);

  const mergedStats = {
    ...stats,
    hunger: lobsterState.hunger,
    mood: lobsterState.mood,
    fatigue: lobsterState.fatigue,
    loyalty: lobsterState.loyalty,
    level: lobsterState.level,
    experience: lobsterState.experience,
    totalInteractions: lobsterState.totalInteractions,
  };
  const achievementsStats = await getAchievements(mergedStats);
  const unlockedIds = achievementsStats.achievements.filter((item) => item.unlocked).map((item) => item.id);
  const previousSnapshot = [...store.history]
    .map((item) => normalizeSnapshot(item))
    .filter((item) => item.date < date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const previousUnlockedIds = new Set(previousSnapshot?.achievements.unlockedIds ?? []);
  const newlyUnlocked = unlockedIds.filter((id) => !previousUnlockedIds.has(id));

  return {
    date,
    generatedAt: new Date().toISOString(),
    stats: {
      level: lobsterState.level,
      experience: lobsterState.experience,
      hunger: lobsterState.hunger,
      mood: lobsterState.mood,
      fatigue: lobsterState.fatigue,
      health: calculateStableHealth(lobsterState),
      loyalty: lobsterState.loyalty,
      totalTokens: stats.totalTokens,
      totalSessions: stats.totalSessions,
      totalInteractions: lobsterState.totalInteractions,
      age: stats.age,
    },
    brain: { ...stats.brain },
    achievements: {
      total: achievementsStats.total,
      unlocked: achievementsStats.unlocked,
      newlyUnlocked,
      unlockedIds,
    },
  };
}

function diffNumber(current: number, previous: number | undefined) {
  return current - (previous ?? 0);
}

export function calculateSnapshotDiff(current: LobsterSnapshot, previous?: LobsterSnapshot | null): SnapshotDiff | null {
  if (!previous) {
    return null;
  }

  const currentSnapshot = toComparableSnapshot(current);
  const previousSnapshot = toComparableSnapshot(previous);
  const currentUnlocked = new Set(currentSnapshot.achievements.unlockedIds);
  const previousUnlocked = new Set(previousSnapshot.achievements.unlockedIds);
  const brainKeys = Object.keys(currentSnapshot.brain) as Array<keyof Brain>;

  return {
    date: currentSnapshot.date,
    previousDate: previousSnapshot.date,
    generatedAt: currentSnapshot.generatedAt,
    levelDelta: diffNumber(currentSnapshot.stats.level, previousSnapshot.stats.level),
    experienceDelta: diffNumber(currentSnapshot.stats.experience, previousSnapshot.stats.experience),
    hungerDelta: diffNumber(currentSnapshot.stats.hunger, previousSnapshot.stats.hunger),
    moodDelta: diffNumber(currentSnapshot.stats.mood, previousSnapshot.stats.mood),
    fatigueDelta: diffNumber(currentSnapshot.stats.fatigue, previousSnapshot.stats.fatigue),
    healthDelta: diffNumber(currentSnapshot.stats.health, previousSnapshot.stats.health),
    loyaltyDelta: diffNumber(currentSnapshot.stats.loyalty, previousSnapshot.stats.loyalty),
    totalTokensDelta: diffNumber(currentSnapshot.stats.totalTokens, previousSnapshot.stats.totalTokens),
    totalSessionsDelta: diffNumber(currentSnapshot.stats.totalSessions, previousSnapshot.stats.totalSessions),
    totalInteractionsDelta: diffNumber(currentSnapshot.stats.totalInteractions, previousSnapshot.stats.totalInteractions),
    ageDelta: diffNumber(currentSnapshot.stats.age, previousSnapshot.stats.age),
    brain: Object.fromEntries(
      brainKeys.map((key) => [key, diffNumber(currentSnapshot.brain[key], previousSnapshot.brain[key])]),
    ) as Record<keyof Brain, number>,
    achievements: {
      unlockedDelta: diffNumber(currentSnapshot.achievements.unlocked, previousSnapshot.achievements.unlocked),
      newlyUnlocked: currentSnapshot.achievements.newlyUnlocked,
      lostUnlocked: [...previousUnlocked].filter((id) => !currentUnlocked.has(id)),
    },
  };
}

async function upsertSnapshot(snapshot: LobsterSnapshot) {
  const store = await readStore();
  const normalized = normalizeSnapshot(snapshot);
  const history = store.history.map((item) => normalizeSnapshot(item));
  const existingIndex = history.findIndex((item) => item.date === normalized.date);
  const previousSnapshot =
    existingIndex > 0
      ? history[existingIndex - 1] ?? null
      : [...history].filter((item) => item.date < normalized.date).sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;

  let created = false;
  if (existingIndex >= 0) {
    history[existingIndex] = normalized;
  } else {
    history.push(normalized);
    created = true;
  }

  const nextHistory = history.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_HISTORY_DAYS);
  const nextStore: SnapshotStore = {
    updatedAt: normalized.generatedAt,
    latest: nextHistory[nextHistory.length - 1] ?? null,
    history: nextHistory,
  };

  await writeStore(nextStore);
  return {
    snapshot: normalized,
    created,
    diff: calculateSnapshotDiff(normalized, previousSnapshot),
  };
}

export async function saveDailySnapshot(date = formatLocalDate()): Promise<SaveDailySnapshotResult> {
  const snapshot = await buildSnapshot(date);
  return upsertSnapshot(snapshot);
}

export async function ensureDailySnapshot(date = formatLocalDate()): Promise<SaveDailySnapshotResult | null> {
  const existing = await getSnapshotByDate(date);
  if (existing) {
    return null;
  }
  return saveDailySnapshot(date);
}

export async function getSnapshotHistory(limit = 30): Promise<LobsterSnapshot[]> {
  const store = await readStore();
  return store.history
    .map((item) => normalizeSnapshot(item))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-Math.max(1, limit));
}

export async function getSnapshotByDate(date: string): Promise<LobsterSnapshot | null> {
  const store = await readStore();
  const snapshot = store.history.find((item) => item.date === date);
  return snapshot ? normalizeSnapshot(snapshot) : null;
}

export async function getLatestSnapshot(): Promise<LobsterSnapshot | null> {
  const store = await readStore();
  return store.latest ? normalizeSnapshot(store.latest) : null;
}

export async function getSnapshotDiff(date = formatLocalDate()): Promise<SnapshotDiff | null> {
  const store = await readStore();
  const history = store.history.map((item) => normalizeSnapshot(item)).sort((a, b) => a.date.localeCompare(b.date));
  const currentIndex = history.findIndex((item) => item.date === date);
  if (currentIndex < 0) {
    return null;
  }
  return calculateSnapshotDiff(history[currentIndex]!, currentIndex > 0 ? history[currentIndex - 1] : null);
}

export function initSnapshotScheduler() {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  void ensureDailySnapshot().catch((error) => {
    console.error('[snapshot-store] initial snapshot failed:', error);
  });

  setInterval(() => {
    void ensureDailySnapshot().catch((error) => {
      console.error('[snapshot-store] scheduled snapshot failed:', error);
    });
  }, SCHEDULER_CHECK_INTERVAL_MS);
}
