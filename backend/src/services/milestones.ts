import { spawn } from 'child_process';

const ACPX = '/Users/moltbot/.nvm/versions/node/v22.22.0/bin/acpx';
const MILESTONE_CACHE_FILE = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data/milestone-enhancements.json';

const ENV = {
  ...process.env,
  PATH: '/Users/moltbot/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin',
  HOME: '/Users/moltbot',
};

// 成长任务系统 - 替代喂食/训练/休息
// 每次交互解锁一个"人生节点"

export interface Milestone {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  requirement?: (stats: LobsterStats) => boolean;
}

export interface MilestoneStats {
  total: number;
  unlocked: number;
  milestones: Milestone[];
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
}

const MILESTONES = [
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
  { id: 'age_30', name: '一月游', desc: '陪伴30天', icon: '🗓️', condition: (s: any) => (s.age || 0) >= 30 },
];

export async function getMilestones(stats: any, milestoneStats: LobsterStats): Promise<MilestoneStats> {
  const mergedStats = { ...stats, ...milestoneStats };
  const milestones: Milestone[] = [];
  let unlocked = 0;

  for (const m of MILESTONES) {
    const isUnlocked = m.condition(mergedStats);
    if (isUnlocked) unlocked++;

    milestones.push({
      id: m.id,
      name: m.name,
      description: m.desc,
      icon: m.icon,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? new Date().toISOString() : undefined,
    });
  }

  return { total: MILESTONES.length, unlocked, milestones };
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

  if (mood < 30) {
    const messages = ['今天有点郁闷...', '感觉你不理我了...', '心情不好，求安慰QAQ'];
    return messages[Math.floor(Math.random() * messages.length)] ?? null;
  }

  return null;
}

// 使用 OpenClaw 增强里程碑描述
function runAcpx(prompt: string, timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ACPX, ['codex', 'prompt', '--', prompt], { 
      env: ENV, 
      timeout: timeoutMs 
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', d => stdout += d);
    child.stderr?.on('data', d => stderr += d);
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 200)}`));
    });
    child.on('error', err => reject(err));
    setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, timeoutMs);
  });
}

// 增强里程碑描述（每天调用一次）
export async function enhanceMilestones(): Promise<Record<string, string>> {
  try {
    const prompt = `你是一个游戏文案大师。请为以下龙虾养成游戏的里程碑成就生成更丰富的描述和背景故事。

里程碑列表：
1. 初心萌动 - 首次相遇，开启养成之旅
2. 三日之约 - 连续3天陪伴
3. 一周伙伴 - 连续7天陪伴
4. 半月同频 - 连续14天陪伴
5. 话痨小龙虾 - 累计50次互动
6. 元老伙伴 - 累计100次互动
7. 灵智初开 - 首次深度对话
8. 知心伙伴 - 累计5次深度对话
9. 心流共鸣 - 累计20次深度对话
10. 全技能掌握 - 解锁全部技能
11. 进化之路 - 完成第一个挑战
12. 挑战达人 - 完成5个挑战
13. 夜猫子 - 首次熬夜陪伴
14. 深夜守护者 - 累计5次熬夜
15. 一月游 - 陪伴30天

请为每个里程碑返回JSON格式的增强描述：
{"id": "描述"}

例如：
{"first_meet": "那天夕阳下，你我初次相遇，从此开启了这段奇妙的养成之旅..."}

只返回JSON，不要其他内容。`;

    const output = await runAcpx(prompt, 90000);
    
    // 解析 JSON
    const match = output.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return {};
  } catch (e) {
    console.error('[enhanceMilestones] 增强失败:', e);
    return {};
  }
}
