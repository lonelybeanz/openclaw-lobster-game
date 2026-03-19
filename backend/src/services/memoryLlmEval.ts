import { readFile } from 'fs/promises';
import { join } from 'path';
import { runOpenClawAgentPrompt } from './openclaw';

const OPENCLAW_CONFIG = '/Users/moltbot/.openclaw/openclaw.json';
const EVAL_AGENT_ID = process.env.OPENCLAW_MEMORY_AGENT ?? 'dev';
const CORE_FILES = ['SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md'] as const;
const MAX_FILE_CHARS = 6000;
const COMMAND_TIMEOUT_MS = 90_000;

type OpenClawAgentListItem = {
  id?: string;
  name?: string;
  identityName?: string;
  workspace?: string;
};

type CoreFileEval = {
  path: string;
  exists: boolean;
  content: string;
  truncated: boolean;
};

type AgentEvaluation = {
  score: number | null;
  grade: string | null;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  raw: string;
};

export type MemoryLlmEvalAgent = {
  agentId: string;
  name: string | null;
  workspaceRoot: string;
  files: CoreFileEval[];
  evaluation: AgentEvaluation;
};

export type MemoryLlmEvalResponse = {
  evaluatorAgentId: string;
  totalAgents: number;
  agents: MemoryLlmEvalAgent[];
};

type ParsedEvalAgent = {
  agentId?: unknown;
  score?: unknown;
  grade?: unknown;
  summary?: unknown;
  strengths?: unknown;
  risks?: unknown;
  suggestions?: unknown;
};

function parseJsonPayload<T>(raw: string): T | null {
  const trimmed = raw.trim();
  let start = -1;

  for (let index = 0; index < trimmed.length; index += 1) {
    const current = trimmed[index];
    if (current !== '{' && current !== '[') {
      continue;
    }
    start = index;
    break;
  }

  if (start < 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start)) as T;
  } catch {
    return null;
  }
}

function clampScore(score: unknown): number | null {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function createFallbackEvaluation(raw: string): AgentEvaluation {
  return {
    score: null,
    grade: null,
    summary: raw.trim(),
    strengths: [],
    risks: [],
    suggestions: [],
    raw,
  };
}

function normalizeEvaluation(value: {
  score?: unknown;
  grade?: unknown;
  summary?: unknown;
  strengths?: unknown;
  risks?: unknown;
  suggestions?: unknown;
} | null | undefined, raw: string): AgentEvaluation {
  return {
    score: clampScore(value?.score),
    grade: typeof value?.grade === 'string' ? value.grade : null,
    summary: typeof value?.summary === 'string' ? value.summary : raw.trim(),
    strengths: normalizeStringList(value?.strengths),
    risks: normalizeStringList(value?.risks),
    suggestions: normalizeStringList(value?.suggestions),
    raw,
  };
}

// 直接从配置文件读取 agent 列表，避免调用 CLI
async function listAgents(): Promise<OpenClawAgentListItem[]> {
  try {
    const content = await readFile(OPENCLAW_CONFIG, 'utf-8');
    const config = JSON.parse(content);
    const agents = config?.agents?.list || [];
    
    return agents
      .filter((item: any) => Boolean(item?.id) && typeof item.workspace === 'string')
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        identityName: item.identity?.name || item.identityName,
        workspace: item.workspace,
      }));
  } catch (error) {
    console.error('[memoryLlmEval] Failed to read agents from config:', error);
    return [];
  }
}

async function readCoreFile(workspaceRoot: string, fileName: string): Promise<CoreFileEval> {
  const path = join(workspaceRoot, fileName);

  try {
    const content = await readFile(path, 'utf-8');
    const truncated = content.length > MAX_FILE_CHARS;
    return {
      path,
      exists: true,
      content: truncated ? `${content.slice(0, MAX_FILE_CHARS)}\n\n[...truncated...]` : content,
      truncated,
    };
  } catch {
    return {
      path,
      exists: false,
      content: '',
      truncated: false,
    };
  }
}

async function loadAgentFiles(agent: OpenClawAgentListItem): Promise<MemoryLlmEvalAgent> {
  const files = await Promise.all(CORE_FILES.map((fileName) => readCoreFile(agent.workspace!, fileName)));
  return {
    agentId: agent.id!,
    name: typeof agent.identityName === 'string' ? agent.identityName : typeof agent.name === 'string' ? agent.name : null,
    workspaceRoot: agent.workspace!,
    files,
    evaluation: createFallbackEvaluation(''),
  };
}

function buildPrompt(agents: MemoryLlmEvalAgent[]) {
  const agentSections = agents.map((agent) => {
    const fileSections = agent.files.map((file) => {
      if (!file.exists) {
        return `文件: ${file.path}\n状态: missing`;
      }

      return [
        `文件: ${file.path}`,
        `状态: present${file.truncated ? ' (truncated)' : ''}`,
        '内容:',
        file.content,
      ].join('\n');
    }).join('\n\n---\n\n');

    return [
      `Agent ID: ${agent.agentId}`,
      `Agent Name: ${agent.name ?? 'unknown'}`,
      `Workspace: ${agent.workspaceRoot}`,
      '',
      fileSections,
    ].join('\n');
  }).join('\n\n====================\n\n');

  return `你是 OpenClaw 记忆系统评估专家。请根据下面多个 agent 的核心记忆文件内容，分别评估每个 agent 记忆系统的质量。

评分维度：
1. 结构完整性
2. 角色一致性
3. 可检索性
4. 可维护性
5. 对长期记忆的支持度

请输出严格 JSON，不要输出任何额外文字，格式如下：
{
  "agents": [
    {
      "agentId": "agent id",
      "score": 0-100 的整数,
      "grade": "S/A/B/C/D",
      "summary": "一句中文总结",
      "strengths": ["优点1", "优点2"],
      "risks": ["风险1", "风险2"],
      "suggestions": ["建议1", "建议2", "建议3"]
    }
  ]
}

要求：
1. 必须覆盖输入中的每个 agent，按 agentId 返回。
2. 不要混淆不同 agent 的内容，必须基于各自 workspace 的文件单独评分。
3. 如果某个 agent 缺失关键文件，请在 summary/risks/suggestions 中明确体现。

评估对象：
${agentSections}`;
}

export async function getMemoryLlmEval(): Promise<MemoryLlmEvalResponse> {
  const listedAgents = await listAgents();
  const agents = await Promise.all(listedAgents.map((agent) => loadAgentFiles(agent)));
  const raw = await runOpenClawAgentPrompt(buildPrompt(agents), COMMAND_TIMEOUT_MS, EVAL_AGENT_ID);
  const parsed = parseJsonPayload<{
    agents?: ParsedEvalAgent[];
  }>(raw);
  const evaluations = new Map(
    (Array.isArray(parsed?.agents) ? parsed.agents : [])
      .filter((item): item is ParsedEvalAgent & { agentId: string } => typeof item?.agentId === 'string')
      .map((item) => [item.agentId, normalizeEvaluation(item, raw)]),
  );

  return {
    evaluatorAgentId: EVAL_AGENT_ID,
    totalAgents: agents.length,
    agents: agents.map((agent) => ({
      ...agent,
      evaluation: evaluations.get(agent.agentId) ?? createFallbackEvaluation(raw),
    })),
  };
}
