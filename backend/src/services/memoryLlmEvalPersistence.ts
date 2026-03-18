import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { MemoryLlmEvalResponse } from './memoryLlmEval';

const DATA_DIR = process.env.LOBSTER_GAME_DATA_DIR ?? resolve(process.cwd(), '..', 'data');
const MEMORY_LLM_EVAL_FILE = resolve(DATA_DIR, 'memory-llm-eval-results.json');
const MAX_RECORDS = 50;

export type MemoryLlmEvalSavedRecord = {
  savedAt: string;
  result: MemoryLlmEvalResponse;
};

type MemoryLlmEvalStore = {
  updatedAt: string | null;
  latest: MemoryLlmEvalSavedRecord | null;
  history: MemoryLlmEvalSavedRecord[];
};

function createEmptyStore(): MemoryLlmEvalStore {
  return {
    updatedAt: null,
    latest: null,
    history: [],
  };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<MemoryLlmEvalStore> {
  try {
    await ensureDataDir();
    const raw = await readFile(MEMORY_LLM_EVAL_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MemoryLlmEvalStore>;
    const history = Array.isArray(parsed.history) ? parsed.history : [];
    const latest = parsed.latest && typeof parsed.latest === 'object' ? parsed.latest : history[0] ?? null;
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : latest?.savedAt ?? null,
      latest,
      history,
    };
  } catch {
    return createEmptyStore();
  }
}

async function writeStore(store: MemoryLlmEvalStore) {
  await ensureDataDir();
  await writeFile(MEMORY_LLM_EVAL_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export async function saveMemoryLlmEvalResult(result: MemoryLlmEvalResponse): Promise<MemoryLlmEvalSavedRecord> {
  const store = await readStore();
  const record: MemoryLlmEvalSavedRecord = {
    savedAt: new Date().toISOString(),
    result,
  };

  const nextStore: MemoryLlmEvalStore = {
    updatedAt: record.savedAt,
    latest: record,
    history: [record, ...store.history].slice(0, MAX_RECORDS),
  };

  await writeStore(nextStore);
  return record;
}

export async function getLatestMemoryLlmEvalResult(): Promise<MemoryLlmEvalSavedRecord | null> {
  const store = await readStore();
  return store.latest;
}
