import { readFile, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { getModelBrainMapping, getModelDescription, type ModelBrainMapping } from './modelMapper';
import { getMemoryScore as getMemoryScoreDetail, type MemoryAgentScore, type MemoryLayerScore } from './memoryScore';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

export interface Brain {
  cerebral: number;
  opticLobes: number;
  antennaLobe: number;
  neurons: number;
  shortTerm: number;
  longTerm: number;
  episodic: number;
  procedural: number;
  amygdala: number;
  cerebellum: number;
  brainstem: number;
}

export interface Limbs {
  claws: number;
  legs: number;
  antennae: number;
  tail: number;
  strength: number;
  agility: number;
  endurance: number;
}

export interface LobsterStats {
  name: string;
  avatar: string;
  personality: string;
  model: string;
  
  level: number;
  experience: number;
  maxExperience: number;
  age: number;
  
  hunger: number;
  health: number;
  
  brain: Brain;
  brainMapping: ModelBrainMapping;
  
  limbs: Limbs;
  
  intelligence: number;
  memoryScore: number;
  skills: number;
  experiencePool: number;
  
  mood: number;
  fatigue: number;
  loyalty: number;
  
  totalTokens: number;
  totalSessions: number;
  totalMessages: number;
  lastActive: string;
  memory: {
    shallow: { count: number; quality: number; recent: string[] };
    deep: { count: number; quality: number; files: string[] };
    organization: number;
    completeness: number;
    overallScore: number;
    indexedAgents: number;
    totalAgents: number;
    layers: MemoryLayerScore[];
    agents: MemoryAgentScore[];
  };
}

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

async function getTokenStats(): Promise<{ totalTokens: number; totalSessions: number }> {
  try {
    const output = await execCommand('openclaw sessions --all-agents --json 2>/dev/null');
    const data = JSON.parse(output);
    const totalTokens = data.sessions?.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0) || 0;
    const totalSessions = data.count || 0;
    return { totalTokens, totalSessions };
  } catch { return { totalTokens: 0, totalSessions: 0 }; }
}

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
  } catch { return { name: 'ZenClaw', avatar: '🦞', personality: '聪明、可靠、幽默' }; }
}

async function getAge(): Promise<number> {
  const DAY_MS = 1000 * 60 * 60 * 24;
  try {
    // 查找最早的记忆文件时间
    const memoryDir = join(OPENCLAW_DIR, 'workspace/memory');
    let earliestMemoryMs = NaN;
    try {
      const files = await readdir(memoryDir);
      for (const file of files) {
        if (file.endsWith('.md') && !file.startsWith('.')) {
          const filePath = join(memoryDir, file);
          const fileStat = await stat(filePath);
          if (!Number.isFinite(earliestMemoryMs) || fileStat.birthtime.getTime() < earliestMemoryMs) {
            earliestMemoryMs = fileStat.birthtime.getTime();
          }
        }
      }
    } catch {}
    
    // 也检查配置文件
    const configPath = join(OPENCLAW_DIR, 'openclaw.json');
    let configCreatedMs = NaN;
    try {
      const configStat = await stat(configPath);
      configCreatedMs = configStat.birthtime.getTime();
    } catch {}
    
    const candidates = [earliestMemoryMs, configCreatedMs].filter((t) => Number.isFinite(t));
    if (candidates.length > 0) {
      const earliestMs = Math.min(...candidates);
      return Math.max(0, Math.floor((Date.now() - earliestMs) / DAY_MS));
    }
  } catch {}
  return 0;
}

async function getSkillCount(): Promise<number> {
  try {
    const { readdir } = await import('fs/promises');
    const skillsDir = join(OPENCLAW_DIR, 'skills');
    const files = await readdir(skillsDir);
    return files.filter(f => !f.startsWith('.') && f !== 'README.md').length;
  } catch { return 0; }
}

async function getMemoryFileCount(): Promise<number> {
  try {
    const { readdir } = await import('fs/promises');
    const memoryDir = join(OPENCLAW_DIR, 'workspace', 'memory');
    const files = await readdir(memoryDir, { recursive: true });
    return files.length;
  } catch { return 0; }
}

function calculateBrain(tokens: number, sessions: number, memoryFiles: number, modelMapping: ModelBrainMapping): Brain {
  const base = Math.min(100, Math.floor(tokens / 10000));
  const benchmark = modelMapping.benchmark;
  
  return {
    cerebral: Math.min(100, Math.floor((base * 0.45) + (modelMapping.reasoning * 0.3) + (benchmark.intelligence * 0.25))),
    opticLobes: Math.min(100, Math.floor((base * 0.5) + (modelMapping.vision * 0.5))),
    antennaLobe: Math.min(100, Math.floor((base * 0.35) + (modelMapping.perception * 0.35) + (benchmark.contextScore * 0.3))),
    neurons: Math.min(100, Math.floor((sessions * 3) + (modelMapping.creativity * 0.3))),
    
    shortTerm: Math.min(100, Math.floor((sessions * 5) + (modelMapping.shortMemory * 0.3))),
    longTerm: Math.min(100, Math.floor((memoryFiles * 1.7) + (modelMapping.contextWindow * 0.2) + (benchmark.contextScore * 0.2))),
    episodic: Math.min(100, Math.floor(sessions * 2)),
    procedural: Math.min(100, Math.floor(sessions * 1.5 + modelMapping.coding * 0.3)),
    
    amygdala: Math.min(100, Math.floor(50 + sessions * 2 + modelMapping.emotion * 0.3)),
    cerebellum: Math.min(100, Math.floor(base * 0.4 + modelMapping.coding * 0.35 + benchmark.speedScore * 0.25)),
    brainstem: Math.min(100, Math.floor(55 + (benchmark.latencyScore * 0.35) + (benchmark.reasoningScore * 0.1))),
  };
}

function calculateLimbs(tokens: number, modelMapping: ModelBrainMapping): Limbs {
  const base = Math.min(100, Math.floor(tokens / 15000));
  const benchmark = modelMapping.benchmark;
  
  return {
    claws: Math.min(100, Math.floor(base * 0.5 + modelMapping.creativity * 0.5)),
    legs: Math.min(100, base + 15),
    antennae: Math.min(100, Math.floor(modelMapping.contextWindow * 0.5 + base * 0.5)),
    tail: Math.min(100, Math.floor(modelMapping.output * 0.4 + benchmark.speedScore * 0.3 + base * 0.3)),
    strength: Math.min(100, base + 12),
    agility: Math.min(100, Math.floor(base * 0.6 + benchmark.latencyScore * 0.4)),
    endurance: Math.min(100, Math.floor(modelMapping.efficiency * 0.35 + benchmark.costScore * 0.35 + base * 0.3)),
  };
}

function calculateLevel(tokens: number): { level: number; experience: number; maxExperience: number } {
  const level = Math.floor(tokens / 50000) + 1;
  const maxExperience = level * 50000;
  const experience = tokens % 50000;
  return { level, experience, maxExperience };
}

export async function getLobsterStats(): Promise<LobsterStats> {
  const [config, age, tokenStats, skillCount, memoryFileCount, modelMapping, modelDesc, memoryDetail] = await Promise.all([
    getOpenClawConfig(),
    getAge(),
    getTokenStats(),
    getSkillCount(),
    getMemoryFileCount(),
    getModelBrainMapping(),
    getModelDescription(),
    getMemoryScoreDetail(),
  ]);
  
  const { level, experience, maxExperience } = calculateLevel(tokenStats.totalTokens);
  const memoryStats = await analyzeMemory();
  const brain = calculateBrain(tokenStats.totalTokens, tokenStats.totalSessions, memoryFileCount, modelMapping);
  const limbs = calculateLimbs(tokenStats.totalTokens, modelMapping);
  
  return {
    name: config.name,
    avatar: config.avatar,
    personality: config.personality,
    model: modelDesc,
    
    level,
    experience,
    maxExperience,
    age,
    hunger: Math.max(20, 100 - new Date().getHours() * 2),
    health: 90 + Math.floor(Math.random() * 10),
    
    brain,
    brainMapping: modelMapping,
    memory: {
      shallow: {
        count: memoryStats.shallowCount,
        quality: memoryStats.shallowQuality,
        recent: memoryStats.shallowRecent
      },
      deep: {
        count: memoryStats.deepCount,
        quality: memoryStats.deepQuality,
        files: memoryStats.deepFiles
      },
      organization: memoryStats.organization,
      completeness: memoryStats.completeness,
      overallScore: memoryDetail.overall.score,
      indexedAgents: memoryDetail.agents.filter((agent) => agent.vectorReady && agent.memorySourceFiles > 0).length,
      totalAgents: memoryDetail.agents.length,
      layers: memoryDetail.layers,
      agents: memoryDetail.agents,
    },
    
    limbs,
    
    intelligence: Math.floor((brain.cerebral * 0.5) + (brain.neurons * 0.2) + (modelMapping.benchmark.intelligence * 0.3)),
    memoryScore: Math.round(memoryDetail.overall.score),
    skills: skillCount,
    experiencePool: Math.floor(tokenStats.totalSessions / 5),
    
    mood: Math.min(100, brain.amygdala),
    fatigue: Math.max(0, 100 - age * 2),
    loyalty: Math.min(100, Math.floor(age * 5)),
    
    totalTokens: tokenStats.totalTokens,
    totalSessions: tokenStats.totalSessions,
    totalMessages: Math.floor(tokenStats.totalTokens / 100),
    lastActive: new Date().toISOString(),
  };
}
export async function getLobsterNews() { return []; }

import { analyzeMemory } from './memoryAnalyzer';
