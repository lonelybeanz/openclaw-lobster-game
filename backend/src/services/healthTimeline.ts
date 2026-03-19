import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface HealthRecord {
  timestamp: string;
  hunger: number;
  mood: number;
  fatigue: number;
  health: number;
  loyalty: number;
  event?: string;
}

export interface HealthTrend {
  period: '7d' | '30d' | '90d';
  records: HealthRecord[];
  averages: {
    hunger: number;
    mood: number;
    fatigue: number;
    health: number;
  };
  trends: {
    hunger: 'rising' | 'falling' | 'stable';
    mood: 'rising' | 'falling' | 'stable';
    fatigue: 'rising' | 'falling' | 'stable';
    health: 'rising' | 'falling' | 'stable';
  };
  anomalies: Array<{
    date: string;
    metric: string;
    value: number;
    reason: string;
  }>;
}

type TrendMetric = keyof Pick<HealthRecord, 'hunger' | 'mood' | 'fatigue' | 'health'>;

const TIMELINE_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../runtime/timeline.log');

let timelineWriteQueue: Promise<void> = Promise.resolve();

function round(value: number) {
  return Number(value.toFixed(1));
}

function clampMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRecord(record: HealthRecord): HealthRecord {
  return {
    timestamp: new Date(record.timestamp).toISOString(),
    hunger: clampMetric(record.hunger),
    mood: clampMetric(record.mood),
    fatigue: clampMetric(record.fatigue),
    health: clampMetric(record.health),
    loyalty: clampMetric(record.loyalty),
    event: record.event?.trim() || undefined,
  };
}

function isFiniteMetric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

async function ensureTimelineDir() {
  await mkdir(dirname(TIMELINE_FILE), { recursive: true });
}

export async function ensureHealthTimelineLog(): Promise<void> {
  await ensureTimelineDir();
  await writeFile(TIMELINE_FILE, '', { flag: 'a' });
}

function queueTimelineWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = timelineWriteQueue.then(task, task);
  timelineWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function recordHealthChange(record: HealthRecord): Promise<void> {
  const normalized = normalizeRecord(record);
  await queueTimelineWrite(async () => {
    await ensureHealthTimelineLog();
    await appendFile(TIMELINE_FILE, `${JSON.stringify(normalized)}\n`, 'utf-8');
  });
}

export async function getHealthRecords(): Promise<HealthRecord[]> {
  try {
    await ensureHealthTimelineLog();
    const content = await readFile(TIMELINE_FILE, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as Partial<HealthRecord>;
          if (
            !parsed.timestamp ||
            !isFiniteMetric(parsed.hunger) ||
            !isFiniteMetric(parsed.mood) ||
            !isFiniteMetric(parsed.fatigue) ||
            !isFiniteMetric(parsed.health) ||
            !isFiniteMetric(parsed.loyalty)
          ) {
            return null;
          }
          return normalizeRecord(parsed as HealthRecord);
        } catch {
          return null;
        }
      })
      .filter((record): record is HealthRecord => Boolean(record))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    return [];
  }
}

function periodDays(period: HealthTrend['period']) {
  switch (period) {
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '7d':
    default:
      return 7;
  }
}

function calculateAverage(records: HealthRecord[], metric: TrendMetric) {
  if (records.length === 0) {
    return 0;
  }
  const total = records.reduce((sum, record) => sum + record[metric], 0);
  return round(total / records.length);
}

function sliceAverage(records: HealthRecord[], metric: TrendMetric, start: number, end: number) {
  const subset = records.slice(start, end);
  return calculateAverage(subset, metric);
}

function calculateTrend(records: HealthRecord[], metric: TrendMetric): 'rising' | 'falling' | 'stable' {
  if (records.length < 2) {
    return 'stable';
  }

  const windowSize = Math.max(1, Math.floor(records.length / 3));
  const startAvg = sliceAverage(records, metric, 0, windowSize);
  const endAvg = sliceAverage(records, metric, records.length - windowSize, records.length);
  const delta = endAvg - startAvg;
  const threshold = metric === 'fatigue' ? 6 : 5;

  if (delta >= threshold) {
    return 'rising';
  }
  if (delta <= -threshold) {
    return 'falling';
  }
  return 'stable';
}

function detectAnomalies(records: HealthRecord[]) {
  const anomalies: HealthTrend['anomalies'] = [];
  const seen = new Set<string>();

  records.forEach((record, index) => {
    const date = record.timestamp;
    const checks: Array<{ metric: TrendMetric; hit: boolean; reason: string }> = [
      { metric: 'hunger', hit: record.hunger <= 25, reason: '饱食度过低，可能长时间未投喂' },
      { metric: 'mood', hit: record.mood <= 30, reason: '心情偏低，互动反馈可能不足' },
      { metric: 'fatigue', hit: record.fatigue >= 80, reason: '疲劳度过高，建议安排休息' },
      { metric: 'health', hit: record.health <= 40, reason: '健康度偏低，需要关注综合状态' },
    ];

    checks.forEach(({ metric, hit, reason }) => {
      if (!hit) {
        return;
      }
      const key = `${date}-${metric}-${reason}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      anomalies.push({
        date,
        metric,
        value: record[metric],
        reason,
      });
    });

    if (index === 0) {
      return;
    }

    const previous = records[index - 1];
    (['hunger', 'mood', 'fatigue', 'health'] as TrendMetric[]).forEach((metric) => {
      const change = record[metric] - previous[metric];
      if (Math.abs(change) < 25) {
        return;
      }
      const reason = `${metric === 'fatigue' ? '疲劳度' : metric === 'hunger' ? '饱食度' : metric === 'mood' ? '心情' : '健康度'}短时间波动过大`;
      const key = `${date}-${metric}-swing`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      anomalies.push({
        date,
        metric,
        value: record[metric],
        reason,
      });
    });
  });

  return anomalies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getHealthTrend(period: HealthTrend['period'] = '7d'): Promise<HealthTrend> {
  const allRecords = await getHealthRecords();
  const since = Date.now() - periodDays(period) * 24 * 60 * 60 * 1000;
  const records = allRecords.filter((record) => new Date(record.timestamp).getTime() >= since);

  return {
    period,
    records,
    averages: {
      hunger: calculateAverage(records, 'hunger'),
      mood: calculateAverage(records, 'mood'),
      fatigue: calculateAverage(records, 'fatigue'),
      health: calculateAverage(records, 'health'),
    },
    trends: {
      hunger: calculateTrend(records, 'hunger'),
      mood: calculateTrend(records, 'mood'),
      fatigue: calculateTrend(records, 'fatigue'),
      health: calculateTrend(records, 'health'),
    },
    anomalies: detectAnomalies(records),
  };
}
