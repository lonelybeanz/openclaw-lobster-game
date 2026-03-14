import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { maybeTriggerRandomEvent, RandomEvent } from './events';

const DATA_DIR = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data';
const STATE_FILE = join(DATA_DIR, 'lobster-state.json');

export interface LobsterState {
  name: string;
  level: number;
  experience: number;
  hunger: number;
  mood: number;
  fatigue: number;
  loyalty: number;
  lastInteraction: string;
  totalInteractions: number;
  achievements: string[];
  lastFed?: string;
  lastTrained?: string;
  lastRested?: string;
}

const defaultState: LobsterState = {
  name: 'ZenClaw',
  level: 1,
  experience: 0,
  hunger: 80,
  mood: 80,
  fatigue: 20,
  loyalty: 50,
  lastInteraction: new Date().toISOString(),
  totalInteractions: 0,
  achievements: []
};

let stateWriteQueue: Promise<void> = Promise.resolve();

// 确保数据目录存在
async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

// 加载状态
export async function loadLobsterState(): Promise<LobsterState> {
  const createDefaultState = (): LobsterState => ({
    ...defaultState,
    achievements: [...defaultState.achievements],
  });
  try {
    await ensureDir();
    const content = await readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      ...createDefaultState(),
      ...parsed,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
  } catch {
    return createDefaultState();
  }
}

// 保存状态
export async function saveLobsterState(state: LobsterState): Promise<void> {
  try {
    await ensureDir();
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('保存状态失败:', e);
  }
}

function queueStateWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = stateWriteQueue.then(task, task);
  stateWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function grantAchievement(state: LobsterState, id: string): boolean {
  if (state.achievements.includes(id)) {
    return false;
  }
  state.achievements.push(id);
  return true;
}

function applyAchievementRules(state: LobsterState, action: 'feed' | 'train' | 'rest'): string[] {
  const unlocked: string[] = [];

  if (action === 'feed' && grantAchievement(state, 'first_feed')) unlocked.push('first_feed');
  if (action === 'train' && grantAchievement(state, 'first_train')) unlocked.push('first_train');
  if (action === 'rest' && grantAchievement(state, 'first_rest')) unlocked.push('first_rest');

  if (state.level >= 5 && grantAchievement(state, 'level_5')) unlocked.push('level_5');
  if (state.level >= 10 && grantAchievement(state, 'level_10')) unlocked.push('level_10');
  if (state.totalInteractions >= 10 && grantAchievement(state, 'interact_10')) unlocked.push('interact_10');
  if (state.totalInteractions >= 50 && grantAchievement(state, 'interact_50')) unlocked.push('interact_50');
  if (state.totalInteractions >= 100 && grantAchievement(state, 'interact_100')) unlocked.push('interact_100');
  if (state.loyalty >= 100 && grantAchievement(state, 'loyalty_100')) unlocked.push('loyalty_100');

  return unlocked;
}

// 交互动作
export async function interact(action: 'feed' | 'train' | 'rest'): Promise<{ state: LobsterState; exp: number; message: string; randomEvent: RandomEvent | null }> {
  return queueStateWrite(async () => {
    const state = await loadLobsterState();
    let exp = 0;
    let message = '';
    const now = new Date().toISOString();

    switch (action) {
      case 'feed':
        state.hunger = Math.min(100, state.hunger + 20);
        state.mood = Math.min(100, state.mood + 5);
        exp = 10;
        message = '🦞 饱餐一顿！饥饿度 +20，心情 +5';
        state.lastFed = now;
        break;
      case 'train':
        if (state.fatigue >= 90) {
          return { state, exp: 0, message: '😴 太累了，需要休息！', randomEvent: null };
        }
        state.experience += 30;
        state.fatigue = Math.min(100, state.fatigue + 15);
        state.loyalty = Math.min(100, state.loyalty + 3);
        exp = 30;
        message = '💪 训练完成！经验 +30，疲劳 +15';
        state.lastTrained = now;
        break;
      case 'rest':
        state.fatigue = Math.max(0, state.fatigue - 30);
        state.mood = Math.min(100, state.mood + 10);
        exp = 5;
        message = '😴 休息完毕！疲劳 -30，心情 +10';
        state.lastRested = now;
        break;
    }

    const randomEvent = maybeTriggerRandomEvent(0.35);
    if (randomEvent) {
      const { effect } = randomEvent;
      if (typeof effect.hunger === 'number') {
        state.hunger = Math.max(0, Math.min(100, state.hunger + effect.hunger));
      }
      if (typeof effect.mood === 'number') {
        state.mood = Math.max(0, Math.min(100, state.mood + effect.mood));
      }
      if (typeof effect.fatigue === 'number') {
        state.fatigue = Math.max(0, Math.min(100, state.fatigue + effect.fatigue));
      }
      if (typeof effect.loyalty === 'number') {
        state.loyalty = Math.max(0, Math.min(100, state.loyalty + effect.loyalty));
      }
      if (typeof effect.experience === 'number') {
        state.experience = Math.max(0, state.experience + effect.experience);
        exp += effect.experience;
      }
      message += `\n🎲 随机事件触发：${randomEvent.title} - ${randomEvent.description}`;
    }

    const expNeeded = state.level * 500;
    if (state.experience >= expNeeded) {
      state.level++;
      state.experience = 0;
      message += `\n🎉 升级到 Lv.${state.level}！`;
    }

    state.lastInteraction = now;
    state.totalInteractions++;

    const unlocked = applyAchievementRules(state, action);
    if (unlocked.length > 0) {
      message += `\n🏆 解锁成就: ${unlocked.join(', ')}`;
    }

    await saveLobsterState(state);
    return { state, exp, message, randomEvent };
  });
}

// 解锁成就
export async function unlockAchievement(achievementId: string): Promise<boolean> {
  return queueStateWrite(async () => {
    const state = await loadLobsterState();
    if (!state.achievements.includes(achievementId)) {
      state.achievements.push(achievementId);
      await saveLobsterState(state);
      return true;
    }
    return false;
  });
}

// 获取成就列表
export async function getAchievements(): Promise<{ id: string; name: string; unlocked: boolean }[]> {
  const state = await loadLobsterState();
  
  const allAchievements = [
    { id: 'first_feed', name: '🍤 第一次投喂' },
    { id: 'first_train', name: '💪 第一次训练' },
    { id: 'first_rest', name: '😴 第一次休息' },
    { id: 'level_5', name: '⭐ 达到 Lv.5' },
    { id: 'level_10', name: '🌟 达到 Lv.10' },
    { id: 'interact_10', name: '👋 互动 10 次' },
    { id: 'interact_50', name: '🤝 互动 50 次' },
    { id: 'interact_100', name: '💎 互动 100 次' },
    { id: 'loyalty_100', name: '❤️ 忠诚度满值' },
    { id: 'memory_master', name: '🧠 记忆大师' }
  ];

  return allAchievements.map(a => ({
    ...a,
    unlocked: state.achievements.includes(a.id)
  }));
}
