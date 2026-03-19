import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

// 缓存：5分钟有效期
let cache: { metrics: LobsterMetrics; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SessionData {
  totalTokens?: number;
  tokenUsage?: { total?: number };
  model?: string;
  updatedAt?: number;
}

export interface LobsterMetrics {
  totalTokens: number;
  totalSessions: number;
  skillCount: number;
  memoryScore: number;
  lastActive: Date | null;
}

/**
 * 从 sessions.json 实时计算龙虾指标（带缓存）
 */
export async function getLobsterMetrics(): Promise<LobsterMetrics> {
  // 检查缓存
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.metrics;
  }

  let totalTokens = 0;
  let totalSessions = 0;
  let lastActive: Date | null = null;

  try {
    const agentsDir = join(OPENCLAW_DIR, 'agents');
    const agentDirs = await readdir(agentsDir, { withFileTypes: true });

    // 只处理主要 agent（dev, main, lobster, pm）
    const mainAgents = ['dev', 'main', 'lobster', 'pm'];
    
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory() || !mainAgents.includes(agentDir.name)) continue;

      const sessionsFile = join(agentsDir, agentDir.name, 'sessions', 'sessions.json');
      try {
        const content = await readFile(sessionsFile, 'utf-8');
        const data = JSON.parse(content) as Record<string, SessionData>;

        for (const session of Object.values(data)) {
          totalSessions++;

          // 获取 token
          const tokens = session.totalTokens || session.tokenUsage?.total || 0;
          totalTokens += tokens;

          // 获取最后活跃时间
          if (session.updatedAt) {
            const sessionDate = new Date(session.updatedAt);
            if (!lastActive || sessionDate > lastActive) {
              lastActive = sessionDate;
            }
          }
        }
      } catch {
        // 跳过
      }
    }
  } catch (err) {
    console.error('[lobsterMetrics] error:', err);
  }

  // 技能数量
  let skillCount = 0;
  try {
    const skillsDir = join(OPENCLAW_DIR, 'skills');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    skillCount = entries.filter(e => e.isDirectory()).length;
  } catch {
    skillCount = 0;
  }

  // 更新缓存
  cache = {
    metrics: {
      totalTokens,
      totalSessions,
      skillCount,
      memoryScore: 99,
      lastActive,
    },
    timestamp: Date.now(),
  };

  return cache.metrics;
}
