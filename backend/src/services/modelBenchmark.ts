import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getCurrentModel } from './modelMapper';

const MODELS_URL = 'https://artificialanalysis.ai/models';
const CACHE_PATH = join(process.cwd(), 'data', 'model-benchmarks.json');
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface ModelBenchmarkItem {
  model: string;
  intelligence_index: number | null;
  reasoning_model: boolean | null;
  price: number | null;
  context_window: number | null;
  output_speed: number | null;
  latency: number | null;
}

interface BenchmarkCache {
  source: string;
  updatedAt: string;
  data: ModelBenchmarkItem[];
}

let benchmarkRefreshTimer: ReturnType<typeof setInterval> | null = null;

function normalizeModelName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const text = value.trim().toLowerCase();
  if (!text) return null;

  const mult = text.endsWith('k') ? 1_000 : text.endsWith('m') ? 1_000_000 : 1;
  const cleaned = text.replace(/[$,%mss,\s]/g, '').replace(/[km]$/, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed * mult;
}

function getField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in obj) return obj[key];
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (['true', 'yes', 'y', '1'].includes(text)) return true;
  if (['false', 'no', 'n', '0'].includes(text)) return false;
  return null;
}

function toBenchmarkItem(row: Record<string, unknown>): ModelBenchmarkItem | null {
  const models = Array.isArray(row.models) ? row.models : [];
  const primaryModel = models.find(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
  );
  const model = String(
    getField(row, ['model', 'name', 'short_name', 'id', 'model_id', 'model_name', 'display_name'])
    ?? primaryModel?.name
    ?? primaryModel?.short_name
    ?? ''
  ).trim();
  if (!model) return null;

  const intelligenceIndex = parseNumber(
    getField(row, ['intelligence_index', 'intelligenceIndex', 'intelligence', 'intelligence_score'])
  );
  const reasoningModelRaw = getField(row, ['reasoning_model', 'reasoningModel', 'reasoning']);
  const reasoningModel = typeof reasoningModelRaw === 'number'
    ? reasoningModelRaw > 0
    : toBoolean(reasoningModelRaw);
  const priceRaw = parseNumber(
    getField(row, [
      'price',
      'cost',
      'price_per_1m',
      'input_price',
      'price_1m_tokens',
    ])
  );
  const inputPrice = parseNumber(getField(row, ['price_1m_input_tokens']));
  const outputPrice = parseNumber(getField(row, ['price_1m_output_tokens']));
  const price = priceRaw
    ?? (inputPrice !== null || outputPrice !== null ? (inputPrice ?? 0) + (outputPrice ?? 0) : null);
  const contextWindow = parseNumber(
    getField(row, ['context_window', 'contextWindow', 'context', 'context_length'])
  );
  const timescaleData = typeof row.timescaleData === 'object' && row.timescaleData !== null
    ? row.timescaleData as Record<string, unknown>
    : null;
  const outputSpeed = parseNumber(
    getField(row, ['output_speed', 'outputSpeed', 'tokens_per_second', 'speed'])
    ?? timescaleData?.median_output_speed
  );
  const latency = parseNumber(
    getField(row, ['latency', 'first_token_latency', 'response_latency'])
    ?? timescaleData?.median_time_to_first_chunk
  );

  const hasExpectedFields = [
    intelligenceIndex,
    reasoningModel,
    price,
    contextWindow,
    outputSpeed,
    latency,
  ].some((value) => value !== null);
  if (!hasExpectedFields) return null;

  return {
    model,
    intelligence_index: intelligenceIndex,
    reasoning_model: reasoningModel,
    price,
    context_window: contextWindow,
    output_speed: outputSpeed,
    latency,
  };
}

function collectRows(input: unknown, rows: Record<string, unknown>[]): void {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) collectRows(item, rows);
    return;
  }
  if (typeof input !== 'object') return;

  const record = input as Record<string, unknown>;
  const maybeItem = toBenchmarkItem(record);
  if (maybeItem) {
    rows.push(record);
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'object' && value !== null) {
      collectRows(value, rows);
    }
  }
}

function extractJsonCandidatesFromHtml(html: string): unknown[] {
  const candidates: unknown[] = [];
  const pushIfParsed = (text: string): void => {
    try {
      const parsed = JSON.parse(text);
      candidates.push(parsed);

      const nextData = parsed as {
        props?: {
          pageProps?: {
            data?: {
              hostModelsWithCaching?: unknown;
            };
          };
        };
      };
      const hostModels = nextData.props?.pageProps?.data?.hostModelsWithCaching;
      if (hostModels) candidates.push(hostModels);
    } catch { }
  };

  try {
    candidates.push(JSON.parse(html));
  } catch { }

  const nextDataMatch = html.match(/<script[^>]*id=['"]__NEXT_DATA__['"][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    pushIfParsed(nextDataMatch[1]);
  }

  const marker = 'window.__NEXT_DATA__';
  const markerIndex = html.indexOf(marker);
  if (markerIndex >= 0) {
    const assignmentIndex = html.indexOf('=', markerIndex);
    const objectStart = assignmentIndex >= 0 ? html.indexOf('{', assignmentIndex) : -1;
    if (objectStart >= 0) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let endIndex = -1;
      for (let i = objectStart; i < html.length; i += 1) {
        const ch = html[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === '{') {
          depth += 1;
          continue;
        }
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
      if (endIndex > objectStart) {
        pushIfParsed(html.slice(objectStart, endIndex + 1));
      }
    }
  }

  return candidates;
}

function dedupeBenchmarks(items: ModelBenchmarkItem[]): ModelBenchmarkItem[] {
  const byModel = new Map<string, ModelBenchmarkItem>();
  for (const item of items) {
    const key = normalizeModelName(item.model);
    if (!key) continue;
    if (!byModel.has(key)) {
      byModel.set(key, item);
    }
  }
  return [...byModel.values()];
}

async function writeCache(items: ModelBenchmarkItem[]): Promise<void> {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  const payload: BenchmarkCache = {
    source: MODELS_URL,
    updatedAt: new Date().toISOString(),
    data: items,
  };
  await writeFile(CACHE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

async function readCache(): Promise<ModelBenchmarkItem[]> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BenchmarkCache>;
    if (!Array.isArray(parsed.data)) return [];
    return parsed.data.filter((item): item is ModelBenchmarkItem =>
      typeof item === 'object' && item !== null && typeof (item as ModelBenchmarkItem).model === 'string'
    );
  } catch {
    return [];
  }
}

export async function fetchModelBenchmarks(): Promise<ModelBenchmarkItem[]> {
  try {
    const response = await fetch(MODELS_URL, {
      headers: {
        accept: 'text/html,application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const candidates = extractJsonCandidatesFromHtml(text);
    const rows: Record<string, unknown>[] = [];
    for (const candidate of candidates) {
      collectRows(candidate, rows);
    }

    const parsed = rows.map(toBenchmarkItem).filter((item): item is ModelBenchmarkItem => item !== null);
    const benchmarks = dedupeBenchmarks(parsed);
    if (benchmarks.length === 0) {
      throw new Error('No benchmark rows were parsed from source');
    }

    await writeCache(benchmarks);
    return benchmarks;
  } catch {
    return await readCache();
  }
}

function extractModelFamily(normalized: string): string {
  // Extract the base family name before common variant suffixes
  // e.g.  "gpt4o" → "gpt"
  const patterns = [
    /^(gpt[34o]+)/,       // gpt3, gpt4, gpt4o
    /^(claude)/,          // claude-3, claude-3.5
    /^(gemini)/,          // gemini-1.5, gemini-2
    /^(minimax)/,         // minimax-m2.5
    /^(llama)/,           // llama-3
    /^(qwen)/,            // qwen-2.5
  ];
  for (const pat of patterns) {
    const m = normalized.match(pat);
    if (m?.[1]) return m[1];
  }
  return '';
}

function findBestBenchmarkMatch(
  benchmarks: ModelBenchmarkItem[],
  modelId: string,
  modelName: string
): ModelBenchmarkItem | null {
  const idNorm = normalizeModelName(modelId);
  const nameNorm = normalizeModelName(modelName);
  if (!idNorm && !nameNorm) return null;

  // 1. Exact match
  const exact = benchmarks.find((item) => {
    const itemNorm = normalizeModelName(item.model);
    return itemNorm === idNorm || itemNorm === nameNorm;
  });
  if (exact) return exact;

  // 2. Substring fuzzy match (original logic)
  const fuzzy = benchmarks.find((item) => {
    const itemNorm = normalizeModelName(item.model);
    return (
      (!!idNorm && (itemNorm.includes(idNorm) || idNorm.includes(itemNorm))) ||
      (!!nameNorm && (itemNorm.includes(nameNorm) || nameNorm.includes(itemNorm)))
    );
  });
  if (fuzzy) return fuzzy;

  // 3. Family-level match: "deepseek-chat" ↔ "DeepSeek-V3" both → "deepseek"
  const idFamily = extractModelFamily(idNorm);
  const nameFamily = extractModelFamily(nameNorm);
  if (idFamily || nameFamily) {
    const familyMatch = benchmarks.find((item) => {
      const itemNorm = normalizeModelName(item.model);
      const itemFamily = extractModelFamily(itemNorm);
      return (!!idFamily && itemFamily === idFamily) || (!!nameFamily && itemFamily === nameFamily);
    });
    if (familyMatch) return familyMatch;
  }

  return null;
}

export async function getCurrentModelBenchmarks(): Promise<ModelBenchmarkItem | null> {
  const model = await getCurrentModel();
  if (!model) return null;

  let benchmarks = await readCache();
  if (benchmarks.length === 0) {
    benchmarks = await fetchModelBenchmarks();
  }

  return findBestBenchmarkMatch(benchmarks, model.id ?? '', model.name ?? '');
}

export async function initModelBenchmarkUpdater(): Promise<void> {
  await fetchModelBenchmarks();
  if (benchmarkRefreshTimer) return;
  benchmarkRefreshTimer = setInterval(() => {
    void fetchModelBenchmarks();
  }, REFRESH_INTERVAL_MS);
}
