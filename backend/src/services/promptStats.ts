import { readdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

export interface OpenClawPromptStats {
  tokens: number;
  memoryFiles: number;
  skills: number;
  hooks: number;
  sessions: number;
  updatedAt: string;
}

function execCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', cmd], {
      cwd: '/Users/moltbot',
      env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH }
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    child.on('close', () => {
      resolve(output);
    });
    child.on('error', reject);
  });
}

async function getTokenAndSessionStats(): Promise<{ tokens: number; sessions: number }> {
  try {
    const output = await execCommand('openclaw sessions --all-agents --json 2>/dev/null');
    const data = JSON.parse(output);
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const tokens = sessions.reduce((sum: number, session: any) => {
      return sum + (Number(session?.totalTokens) || 0);
    }, 0);

    return {
      tokens,
      sessions: Number(data.count) || sessions.length,
    };
  } catch {
    return { tokens: 0, sessions: 0 };
  }
}

async function countItemsInDir(dir: string, recursive = false): Promise<number> {
  try {
    const items = await readdir(dir, { recursive });
    return items.filter((item) => {
      if (typeof item !== 'string') return false;
      const name = item.split('/').pop() || item;
      return !name.startsWith('.') && name !== 'README.md';
    }).length;
  } catch {
    return 0;
  }
}

export async function getPromptStats(): Promise<OpenClawPromptStats> {
  const [tokenStats, memoryFiles, skills, hooks] = await Promise.all([
    getTokenAndSessionStats(),
    countItemsInDir(join(OPENCLAW_DIR, 'workspace', 'memory'), true),
    countItemsInDir(join(OPENCLAW_DIR, 'skills')),
    countItemsInDir(join(OPENCLAW_DIR, 'hooks')),
  ]);

  return {
    tokens: tokenStats.tokens,
    memoryFiles,
    skills,
    hooks,
    sessions: tokenStats.sessions,
    updatedAt: new Date().toISOString(),
  };
}
