import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import { spawn } from 'child_process';
import { runOpenClawAgentPrompt } from './openclaw';

const OPENCLAW_BIN = '/Users/moltbot/.nvm/versions/node/v22.22.0/bin/openclaw';
const WORKSPACE_ROOT = process.env.OPENCLAW_MEMORY_WORKSPACE ?? '/Users/moltbot/.openclaw/workspace-dev';
const PRIMARY_AGENT_ID = process.env.OPENCLAW_MEMORY_AGENT ?? 'dev';
const DATA_DIR = process.env.LOBSTER_GAME_DATA_DIR ?? '/Users/moltbot/.openclaw/workspace-dev/projects/openclaw-lobster-game/data';
const SCORE_HISTORY_FILE = join(DATA_DIR, 'memory-score-history.json');
const TEST_REPORT_FILE = join(DATA_DIR, 'memory-test-reports.json');
const TEST_CASE_FILE = join(DATA_DIR, 'memory-test-cases.json');
const COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_TEST_INTERVAL_MINUTES = 180;
const MAX_HISTORY_DAYS = 90;
const MAX_REPORTS = 50;

type RawMemoryStatus = {
  agentId: string;
  status?: {
    backend?: string;
    provider?: string;
    files?: number;
    chunks?: number;
    dirty?: boolean;
    workspaceDir?: string;
    vector?: {
      enabled?: boolean;
      available?: boolean;
    };
    sourceCounts?: Array<{
      source?: string;
      files?: number;
      chunks?: number;
    }>;
  };
  scan?: {
    issues?: string[];
    sources?: Array<{
      source?: string;
      issues?: string[];
    }>;
  };
};

type OpenClawAgentListItem = {
  id?: string;
};

export type MemoryLayerFile = {
  path: string;
  label: string;
  exists: boolean;
  size: number;
  updatedAt: string | null;
  qualityScore: number;
  indexed: boolean;
};

export type MemoryLayerScore = {
  key: 'l1' | 'l2' | 'l3';
  label: string;
  score: number;
  completenessScore: number;
  qualityScore: number;
  indexScore: number;
  indexed: boolean;
  files: MemoryLayerFile[];
  summary: string;
};

export type AgentIndexStatus = {
  agentId: string;
  workspaceDir: string;
  backend: string;
  vectorReady: boolean;
  indexedFiles: number;
  indexedChunks: number;
  memorySourceFiles: number;
  sessionSourceFiles: number;
  dirty: boolean;
  issues: string[];
  score: number;
};

export type MemoryAgentScore = AgentIndexStatus;

export type MemoryScoreHistoryItem = {
  date: string;
  score: number;
  l1: number;
  l2: number;
  l3: number;
  indexHealth: number;
};

export type MemoryTestCase = {
  id: string;
  agentId: string;
  query: string;
  minResults: number;
  expectedAny?: string[];
};

export type MemoryTestCaseResult = {
  id: string;
  agentId: string;
  query: string;
  latencyMs: number;
  hitCount: number;
  passed: boolean;
  matchedExpectation: boolean;
  evaluationMethod?: 'keyword' | 'llm';
  evaluationReason?: string;
  error?: string;
};

type LlmEvaluationResult = {
  passed: boolean;
  reason: string;
  raw: string;
};

export type MemoryTestReport = {
  runAt: string;
  durationMs: number;
  totalCases: number;
  passedCases: number;
  accuracyRate: number;
  averageLatencyMs: number;
  results: MemoryTestCaseResult[];
};

export type MemoryScoreResponse = {
  workspaceRoot: string;
  overallScore: number;
  indexedAgents: number;
  totalAgents: number;
  overall: {
    score: number;
    grade: string;
    completenessScore: number;
    qualityScore: number;
    indexScore: number;
  };
  layers: MemoryLayerScore[];
  agents: AgentIndexStatus[];
  history: MemoryScoreHistoryItem[];
  latestTestReport: MemoryTestReport | null;
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    testCaseCount: number;
    lastRunAt: string | null;
  };
};

let schedulerStarted = false;
let lastScheduledRunAt: string | null = null;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function gradeForScore(score: number) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonPayload<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  let start = -1;
  for (let index = 0; index < trimmed.length; index += 1) {
    const current = trimmed[index];
    if (current !== '[' && current !== '{') {
      continue;
    }
    let probe = index + 1;
    while (probe < trimmed.length && /\s/.test(trimmed[probe] ?? '')) {
      probe += 1;
    }
    const nextChar = trimmed[probe] ?? '';
    if ((current === '[' && (nextChar === '{' || nextChar === '[' || nextChar === ']')) || (current === '{' && nextChar === '"')) {
      start = index;
      break;
    }
  }
  const payload = start >= 0 ? trimmed.slice(start) : trimmed;
  try {
    return JSON.parse(payload) as T;
  } catch {
    return fallback;
  }
}

function runCommand(args: string[], timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, args, {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        PATH: '/Users/moltbot/.nvm/versions/node/v22.22.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
        HOME: '/Users/moltbot',
      },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('timeout'));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(`${stderr}${stdout}`.trim());
        return;
      }
      reject(new Error(`${stderr}${stdout}`.trim() || `exit ${code}`));
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function evaluateContentQuality(content: string): number {
  const text = content.trim();
  if (!text) {
    return 0;
  }
  const lines = text.split('\n');
  const titleCount = lines.filter((line) => line.startsWith('#')).length;
  const listCount = lines.filter((line) => /^[-*]\s/.test(line)).length;
  const longLineCount = lines.filter((line) => line.trim().length >= 20).length;

  let score = 10;
  score += Math.min(22, titleCount * 8);
  score += Math.min(20, listCount * 4);
  score += Math.min(18, longLineCount * 2);
  score += text.includes('|') ? 10 : 0;
  score += /\d{4}-\d{2}-\d{2}/.test(text) ? 10 : 0;
  score += /置信度|\[[0-9]{1,2}\/10\]/.test(text) ? 10 : 0;

  if (text.length >= 300 && text.length <= 5000) {
    score += 20;
  } else if (text.length > 80) {
    score += 10;
  }
  return clamp(score);
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown) {
  try {
    await ensureDataDir();
    await writeFile(path, JSON.stringify(value, null, 2));
  } catch (error) {
    console.error('[memory-score] writeJsonFile failed:', path, error);
  }
}

async function getLayerFile(path: string, label: string, indexed: boolean): Promise<MemoryLayerFile> {
  try {
    const [content, fileStat] = await Promise.all([readFile(path, 'utf-8'), stat(path)]);
    return {
      path,
      label,
      exists: true,
      size: fileStat.size,
      updatedAt: new Date(fileStat.mtimeMs).toISOString(),
      qualityScore: evaluateContentQuality(content),
      indexed,
    };
  } catch {
    return {
      path,
      label,
      exists: false,
      size: 0,
      updatedAt: null,
      qualityScore: 0,
      indexed: false,
    };
  }
}

async function listDailyMemoryFiles() {
  const memoryDir = join(WORKSPACE_ROOT, 'memory');
  try {
    const files = await readdir(memoryDir);
    return files.filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file)).sort().map((file) => join(memoryDir, file));
  } catch {
    return [];
  }
}

function getAgentIndexScore(agent: Omit<AgentIndexStatus, 'score'>) {
  let score = 0;
  score += agent.vectorReady ? 45 : 0;
  score += agent.indexedChunks > 0 ? 25 : 0;
  score += agent.memorySourceFiles > 0 ? 20 : 0;
  score += agent.dirty ? 0 : 10;
  return clamp(score);
}

export async function getMemoryIndexStatuses(): Promise<AgentIndexStatus[]> {
  try {
    const output = await runCommand(['memory', 'status', '--json']);
    const rawStatuses = parseJsonPayload<RawMemoryStatus[]>(output, []);
    return rawStatuses.map((item) => {
      const memorySource = item.status?.sourceCounts?.find((source) => source.source === 'memory');
      const sessionSource = item.status?.sourceCounts?.find((source) => source.source === 'sessions');
      const base = {
        agentId: item.agentId,
        workspaceDir: item.status?.workspaceDir ?? '',
        backend: item.status?.backend ?? item.status?.provider ?? 'unknown',
        vectorReady: Boolean(item.status?.vector?.enabled && item.status?.vector?.available),
        indexedFiles: item.status?.files ?? 0,
        indexedChunks: item.status?.chunks ?? 0,
        memorySourceFiles: memorySource?.files ?? 0,
        sessionSourceFiles: sessionSource?.files ?? 0,
        dirty: Boolean(item.status?.dirty),
        issues: [
          ...(item.scan?.issues ?? []),
          ...((item.scan?.sources ?? []).flatMap((source) => source.issues ?? [])),
        ],
      };

      return {
        ...base,
        score: getAgentIndexScore(base),
      };
    });
  } catch (error) {
    return [
      {
        agentId: PRIMARY_AGENT_ID,
        workspaceDir: WORKSPACE_ROOT,
        backend: 'unknown',
        vectorReady: false,
        indexedFiles: 0,
        indexedChunks: 0,
        memorySourceFiles: 0,
        sessionSourceFiles: 0,
        dirty: true,
        issues: [error instanceof Error ? error.message : 'memory status failed'],
        score: 0,
      },
    ];
  }
}

async function buildLayerScores(agentStatuses: AgentIndexStatus[]): Promise<MemoryLayerScore[]> {
  const primaryAgent = agentStatuses.find((item) => item.agentId === PRIMARY_AGENT_ID) ?? agentStatuses[0];
  const sharedIndexScore = primaryAgent?.score ?? 0;
  const sharedIndexed = Boolean(primaryAgent?.vectorReady && primaryAgent?.memorySourceFiles > 0);

  const l1Files = await Promise.all(
    [
      { label: 'SOUL.md', path: join(WORKSPACE_ROOT, 'SOUL.md') },
      { label: 'AGENTS.md', path: join(WORKSPACE_ROOT, 'AGENTS.md') },
      { label: 'USER.md', path: join(WORKSPACE_ROOT, 'USER.md') },
    ].map((item) => getLayerFile(item.path, item.label, sharedIndexed)),
  );

  const l2Files = await Promise.all(
    [{ label: 'MEMORY.md', path: join(WORKSPACE_ROOT, 'MEMORY.md') }].map((item) => getLayerFile(item.path, item.label, sharedIndexed)),
  );

  const dailyFiles = await listDailyMemoryFiles();
  const l3Targets = dailyFiles.length > 0
    ? dailyFiles.slice(-7).reverse().map((path) => ({ label: basename(path), path }))
    : [{ label: `${todayString()}.md`, path: join(WORKSPACE_ROOT, 'memory', `${todayString()}.md`) }];
  const l3Files = await Promise.all(l3Targets.map((item) => getLayerFile(item.path, item.label, sharedIndexed)));

  const createLayer = (key: MemoryLayerScore['key'], label: string, files: MemoryLayerFile[]) => {
    const existingCount = files.filter((file) => file.exists).length;
    const completenessScore = Math.round((existingCount / files.length) * 100);
    const qualityScore = average(files.filter((file) => file.exists).map((file) => file.qualityScore));
    const indexScore = files.some((file) => file.exists) && sharedIndexed ? sharedIndexScore : 0;
    const score = Math.round(completenessScore * 0.35 + qualityScore * 0.4 + indexScore * 0.25);

    return {
      key,
      label,
      score,
      completenessScore,
      qualityScore,
      indexScore,
      indexed: indexScore > 0,
      files,
      summary: `${label} ${score}分，文件 ${existingCount}/${files.length}，索引 ${files.filter((file) => file.indexed).length}/${files.length}`,
    };
  };

  return [
    createLayer('l1', 'L1 基础层', l1Files),
    createLayer('l2', 'L2 深层记忆', l2Files),
    createLayer('l3', 'L3 工作记忆', l3Files),
  ];
}

async function upsertHistory(item: MemoryScoreHistoryItem) {
  const history = await readJsonFile<MemoryScoreHistoryItem[]>(SCORE_HISTORY_FILE, []);
  const existingIndex = history.findIndex((entry) => entry.date === item.date);
  if (existingIndex >= 0) {
    history[existingIndex] = item;
  } else {
    history.push(item);
  }
  const nextHistory = history.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_HISTORY_DAYS);
  await writeJsonFile(SCORE_HISTORY_FILE, nextHistory);
  return nextHistory;
}

async function readReports() {
  return readJsonFile<MemoryTestReport[]>(TEST_REPORT_FILE, []);
}

async function appendReport(report: MemoryTestReport) {
  const reports = await readReports();
  reports.push(report);
  await writeJsonFile(TEST_REPORT_FILE, reports.slice(-MAX_REPORTS));
}

async function getDefaultTestCases(): Promise<MemoryTestCase[]> {
  const defaultQueries = ['memory', 'task', 'config'];

  try {
    const output = await runCommand(['agents', 'list', '--json']);
    const agents = parseJsonPayload<OpenClawAgentListItem[]>(output, [])
      .map((item) => item.id?.trim())
      .filter((agentId): agentId is string => Boolean(agentId));

    if (agents.length > 0) {
      return agents.flatMap((agentId) =>
        defaultQueries.map((query) => ({
          id: `${agentId}-${query}`,
          agentId,
          query,
          minResults: 1,
        })),
      );
    }
  } catch (error) {
    console.error('[memory-score] getDefaultTestCases failed:', error);
  }

  return defaultQueries.map((query) => ({
    id: `${PRIMARY_AGENT_ID}-${query}`,
    agentId: PRIMARY_AGENT_ID,
    query,
    minResults: 1,
  }));
}

async function loadTestCases() {
  const customCases = await readJsonFile<MemoryTestCase[]>(TEST_CASE_FILE, []);
  return customCases.length > 0 ? customCases : getDefaultTestCases();
}

function extractSearchResults(raw: string) {
  return parseJsonPayload<{ results?: Array<Record<string, unknown>> }>(raw, { results: [] }).results ?? [];
}

function matchesExpectation(results: Array<Record<string, unknown>>, expectedAny?: string[]) {
  if (!expectedAny || expectedAny.length === 0) {
    return results.length > 0;
  }
  const haystack = JSON.stringify(results).toLowerCase();
  return expectedAny.some((item) => haystack.includes(item.toLowerCase()));
}

export async function evaluateWithLLM(query: string, results: Array<Record<string, unknown>>): Promise<LlmEvaluationResult> {
  if (results.length === 0) {
    return {
      passed: false,
      reason: 'no results',
      raw: '',
    };
  }

  const prompt = `请判断下面检索到的记忆内容是否与查询相关。

查询：${query}

记忆内容：
${JSON.stringify(results, null, 2)}

请使用这个标准问题进行判断：这段记忆内容是否与查询"${query}"相关？

请严格按以下格式返回，不要输出其他内容：
yes/no
原因：<一句简短原因>`;

  const raw = await runOpenClawAgentPrompt(prompt, COMMAND_TIMEOUT_MS, PRIMARY_AGENT_ID);
  const normalized = raw.trim().toLowerCase();
  const firstLine = normalized.split('\n').find((line) => line.trim().length > 0) ?? '';
  const passed = firstLine.startsWith('yes');
  const reasonMatch = raw.match(/原因[:：]\s*(.+)/i);
  const reason = reasonMatch?.[1]?.trim() || raw.trim().split('\n').slice(1).join(' ').trim() || raw.trim();

  return {
    passed,
    reason,
    raw,
  };
}

export async function runMemoryRetrievalTests(): Promise<MemoryTestReport> {
  const testCases = await loadTestCases();
  const startedAt = Date.now();
  const results: MemoryTestCaseResult[] = [];

  for (const testCase of testCases) {
    const caseStart = Date.now();
    try {
      const output = await runCommand(
        ['memory', 'search', '--agent', testCase.agentId, '--query', testCase.query, '--max-results', '3', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      const hits = extractSearchResults(output);
      const useLlmEvaluation = !testCase.expectedAny || testCase.expectedAny.length === 0;
      const llmEvaluation = useLlmEvaluation ? await evaluateWithLLM(testCase.query, hits) : null;
      const matchedExpectation = llmEvaluation ? llmEvaluation.passed : matchesExpectation(hits, testCase.expectedAny);
      const passed = hits.length >= testCase.minResults && matchedExpectation;
      results.push({
        id: testCase.id,
        agentId: testCase.agentId,
        query: testCase.query,
        latencyMs: Date.now() - caseStart,
        hitCount: hits.length,
        passed,
        matchedExpectation,
        evaluationMethod: llmEvaluation ? 'llm' : 'keyword',
        evaluationReason: llmEvaluation?.reason,
        error: passed ? undefined : hits.length === 0 ? 'no results' : llmEvaluation ? llmEvaluation.reason : 'expectation mismatch',
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        agentId: testCase.agentId,
        query: testCase.query,
        latencyMs: Date.now() - caseStart,
        hitCount: 0,
        passed: false,
        matchedExpectation: false,
        evaluationMethod: !testCase.expectedAny || testCase.expectedAny.length === 0 ? 'llm' : 'keyword',
        error: error instanceof Error ? error.message.slice(0, 280) : 'search failed',
      });
    }
  }

  const passedCases = results.filter((item) => item.passed).length;
  const report: MemoryTestReport = {
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalCases: results.length,
    passedCases,
    accuracyRate: results.length === 0 ? 0 : Math.round((passedCases / results.length) * 100),
    averageLatencyMs: results.length === 0 ? 0 : Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length),
    results,
  };
  await appendReport(report);
  lastScheduledRunAt = report.runAt;
  return report;
}

export async function getLatestMemoryTestReport(): Promise<MemoryTestReport | null> {
  const reports = await readReports();
  return reports.length > 0 ? reports[reports.length - 1] ?? null : null;
}

function getSchedulerConfig() {
  const enabled = process.env.MEMORY_TEST_ENABLED !== 'false';
  const intervalMinutes = Math.max(
    5,
    Number.parseInt(process.env.MEMORY_TEST_INTERVAL_MINUTES ?? String(DEFAULT_TEST_INTERVAL_MINUTES), 10) || DEFAULT_TEST_INTERVAL_MINUTES,
  );
  return { enabled, intervalMinutes };
}

export function initMemoryTestScheduler() {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;
  const scheduler = getSchedulerConfig();
  if (!scheduler.enabled) {
    return;
  }
  setInterval(() => {
    void runMemoryRetrievalTests().catch((error) => {
      console.error('[memory-score] scheduled test failed:', error);
    });
  }, scheduler.intervalMinutes * 60 * 1000);
}

export async function getMemoryScore(): Promise<MemoryScoreResponse> {
  const agentStatuses = await getMemoryIndexStatuses();
  const layers = await buildLayerScores(agentStatuses);
  const completenessScore = average(layers.map((layer) => layer.completenessScore));
  const qualityScore = average(layers.map((layer) => layer.qualityScore));
  const indexScore = average(agentStatuses.map((agent) => agent.score));
  const overallScore = Math.round(average(layers.map((layer) => layer.score)) * 0.75 + indexScore * 0.25);
  const history = await upsertHistory({
    date: todayString(),
    score: overallScore,
    l1: layers.find((layer) => layer.key === 'l1')?.score ?? 0,
    l2: layers.find((layer) => layer.key === 'l2')?.score ?? 0,
    l3: layers.find((layer) => layer.key === 'l3')?.score ?? 0,
    indexHealth: indexScore,
  });
  const latestTestReport = await getLatestMemoryTestReport();
  const scheduler = getSchedulerConfig();
  const testCases = await loadTestCases();

  return {
    workspaceRoot: WORKSPACE_ROOT,
    overallScore,
    indexedAgents: agentStatuses.filter((agent) => agent.vectorReady && agent.memorySourceFiles > 0).length,
    totalAgents: agentStatuses.length,
    overall: {
      score: overallScore,
      grade: gradeForScore(overallScore),
      completenessScore,
      qualityScore,
      indexScore,
    },
    layers,
    agents: agentStatuses,
    history,
    latestTestReport,
    scheduler: {
      enabled: scheduler.enabled,
      intervalMinutes: scheduler.intervalMinutes,
      testCaseCount: testCases.length,
      lastRunAt: lastScheduledRunAt ?? latestTestReport?.runAt ?? null,
    },
  };
}

export const buildMemoryScoreSnapshot = getMemoryScore;
