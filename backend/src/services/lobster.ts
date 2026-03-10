import { readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

export interface LobsterStats {
  name: string;
  avatar: string;
  personality: string;
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
}

// 执行 CLI 命令
function execCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', cmd], { 
      cwd: '/Users/moltbot',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH }
    });
    let output = '';
    child.stdout.on('data', (data) => output += data);
    child.stderr.on('data', (data) => output += data);
    child.on('close', (code) => resolve(output));
    child.on('error', reject);
  });
}

// 从 OpenClaw CLI 获取 token 统计
async function getTokenStats(): Promise<{ totalTokens: number; totalSessions: number }> {
  try {
    const output = await execCommand('openclaw sessions --all-agents --json 2>/dev/null');
    const data = JSON.parse(output);
    const totalTokens = data.sessions?.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0) || 0;
    const totalSessions = data.count || 0;
    return { totalTokens, totalSessions };
  } catch (e) {
    console.log('Failed to get token stats:', e);
    return { totalTokens: 0, totalSessions: 0 };
  }
}

// 读取 OpenClaw 配置
async function getOpenClawConfig(): Promise<{ name: string; avatar: string; personality: string }> {
  try {
    const configPath = join(OPENCLAW_DIR, 'openclaw.json');
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    return {
      name: config.meta?.name || 'ZenClaw',
      avatar: config.meta?.avatar || '🦞',
      personality: config.meta?.personality || '聪明、可靠、幽默',
    };
  } catch {
    return { name: 'ZenClaw', avatar: '🦞', personality: '聪明、可靠、幽默' };
  }
}

// 获取年龄
async function getAge(): Promise<number> {
  try {
    const configPath = join(OPENCLAW_DIR, 'openclaw.json');
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    const createdAt = config.wizard?.lastRunAt || config.meta?.lastTouchedAt;
    if (createdAt) {
      return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    }
  } catch {}
  return Math.floor((Date.now() - new Date('2026-03-04').getTime()) / (1000 * 60 * 60 * 24));
}

// 获取技能数
async function getSkillCount(): Promise<number> {
  try {
    const { readdir } = await import('fs/promises');
    const skillsDir = join(OPENCLAW_DIR, 'skills');
    const files = await readdir(skillsDir);
    return files.filter(f => !f.startsWith('.') && f !== 'README.md').length;
  } catch {
    return 0;
  }
}

// 获取记忆质量
async function getMemoryScore(): Promise<number> {
  try {
    const { readdir } = await import('fs/promises');
    const memoryDir = join(OPENCLAW_DIR, 'workspace', 'memory');
    const files = await readdir(memoryDir, { recursive: true });
    return files.length;
  } catch {
    return 0;
  }
}

function calculateLevel(tokens: number): { level: number; experience: number; maxExperience: number } {
  const level = Math.floor(tokens / 50000) + 1;
  const maxExperience = level * 50000;
  const experience = tokens % 50000;
  return { level, experience, maxExperience };
}

export async function getLobsterStats(): Promise<LobsterStats> {
  const [config, age, tokenStats, skillCount, memoryScore] = await Promise.all([
    getOpenClawConfig(),
    getAge(),
    getTokenStats(),
    getSkillCount(),
    getMemoryScore(),
  ]);
  
  const { level, experience, maxExperience } = calculateLevel(tokenStats.totalTokens);
  
  return {
    name: config.name,
    avatar: config.avatar,
    personality: config.personality,
    level,
    experience,
    maxExperience,
    age,
    hunger: Math.max(20, 100 - new Date().getHours() * 2),
    intelligence: 8,
    memory: memoryScore,
    skills: skillCount,
    experiencePool: Math.floor(tokenStats.totalSessions / 5),
    mood: 80,
    fatigue: 10,
    loyalty: Math.min(100, Math.floor(age * 5)),
    totalTokens: tokenStats.totalTokens,
    totalSessions: tokenStats.totalSessions,
    totalMessages: Math.floor(tokenStats.totalTokens / 100),
    lastActive: new Date().toISOString(),
  };
}
