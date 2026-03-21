import { describe, expect, test } from 'bun:test';
import { buildEvolutionScoreTrend } from './evolutionScore';
import type { ModelBrainMapping } from './modelMapper';

const modelMapping: ModelBrainMapping = {
  reasoning: 80,
  logic: 70,
  vision: 60,
  perception: 65,
  contextWindow: 80,
  shortMemory: 70,
  coding: 75,
  creativity: 85,
  emotion: 70,
  output: 60,
  efficiency: 90,
  benchmark: {
    intelligence: 78,
    reasoningScore: 82,
    contextScore: 88,
    speedScore: 76,
    latencyScore: 74,
    costScore: 84,
  },
};

describe('buildEvolutionScoreTrend', () => {
  test('returns requested number of days and rising trend for rising inputs', () => {
    const trend = buildEvolutionScoreTrend({
      days: 3,
      totalTokens: 36000,
      totalSessions: 12,
      increments: [
        { date: '2026-03-18', added: 8000 },
        { date: '2026-03-19', added: 12000 },
        { date: '2026-03-20', added: 16000 },
      ],
      history: [
        { updatedAt: '2026-03-18T10:00:00.000Z', tokens: 3000 },
        { updatedAt: '2026-03-19T10:00:00.000Z', tokens: 4000 },
        { updatedAt: '2026-03-20T10:00:00.000Z', tokens: 5000 },
      ],
      memoryHistory: [
        { date: '2026-03-18', score: 55, l1: 50, l2: 52, l3: 54, indexHealth: 50 },
        { date: '2026-03-19', score: 63, l1: 57, l2: 60, l3: 61, indexHealth: 60 },
        { date: '2026-03-20', score: 71, l1: 65, l2: 68, l3: 70, indexHealth: 68 },
      ],
      memoryFileCount: 8,
      shallowMemoryQuality: 66,
      modelMapping,
    });

    expect(trend).toHaveLength(3);
    expect(trend[0]?.label).toBe('03-18');
    expect(trend[2]?.label).toBe('03-20');
    expect(trend[0]?.value).toBeLessThan(trend[1]?.value ?? 0);
    expect(trend[1]?.value).toBeLessThan(trend[2]?.value ?? 0);
  });
});
