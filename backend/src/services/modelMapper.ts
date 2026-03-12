import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCurrentModelBenchmarks } from './modelBenchmark';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';

interface ModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  cost: { input: number; output: number };
}

// 从配置读取模型
export async function getCurrentModel(): Promise<ModelConfig | null> {
  try {
    const configPath = join(OPENCLAW_DIR, 'openclaw.json');
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    const models = config.models?.providers;
    if (!models) return null;
    
    // 优先使用 minimax M2.5
    if (models.minimax?.models?.[0]) {
      return models.minimax.models[0];
    }
    
    // 取第一个可用模型
    for (const provider of Object.values(models)) {
      if (provider.models?.[0]) {
        return provider.models[0];
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// 模型属性 → 大脑属性映射
export interface ModelBrainMapping {
  // 推理相关
  reasoning: number;        // 大脑皮层
  logic: number;           // 大脑皮层
  
  // 感知相关
  vision: number;          // 视叶
  perception: number;      // 触角叶
  
  // 记忆相关
  contextWindow: number;   // 长期记忆 (归一化到 0-100)
  shortMemory: number;     // 短期记忆
  
  // 技能相关
  coding: number;         // 小脑 - 协调能力
  creativity: number;      // 神经元
  
  // 情感相关
  emotion: number;         // 杏仁核
  
  // 输出相关
  output: number;          // 尾巴
  
  // 效率
  efficiency: number;      // 耐力

  // 外部评测
  benchmark: {
    intelligence: number;
    reasoningScore: number;
    contextScore: number;
    speedScore: number;
    latencyScore: number;
    costScore: number;
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapBenchmarkScores(benchmark: Awaited<ReturnType<typeof getCurrentModelBenchmarks>>): ModelBrainMapping['benchmark'] {
  if (!benchmark) {
    return {
      intelligence: 50,
      reasoningScore: 50,
      contextScore: 50,
      speedScore: 50,
      latencyScore: 50,
      costScore: 50,
    };
  }

  return {
    intelligence: clampScore(benchmark.intelligence_index ?? 50),
    reasoningScore: benchmark.reasoning_model === null ? 50 : benchmark.reasoning_model ? 85 : 55,
    contextScore: clampScore(((benchmark.context_window ?? 200_000) / 200_000) * 100),
    speedScore: clampScore(((benchmark.output_speed ?? 40) / 120) * 100),
    latencyScore: clampScore(100 - ((benchmark.latency ?? 800) / 2_000) * 100),
    costScore: clampScore(100 - ((benchmark.price ?? 10) / 30) * 100),
  };
}

// 将模型配置映射到大脑属性
export async function getModelBrainMapping(): Promise<ModelBrainMapping> {
  const [model, benchmark] = await Promise.all([
    getCurrentModel(),
    getCurrentModelBenchmarks(),
  ]);
  const benchmarkScores = mapBenchmarkScores(benchmark);
  
  if (!model) {
    return {
      reasoning: 50,
      logic: 50,
      vision: 50,
      perception: 50,
      contextWindow: 50,
      shortMemory: 50,
      coding: 50,
      creativity: 50,
      emotion: 50,
      output: 50,
      efficiency: 50,
      benchmark: benchmarkScores,
    };
  }
  
  const ctxNorm = Math.min(100, (model.contextWindow || 200000) / 5000);
  const maxTokNorm = Math.min(100, (model.maxTokens || 8192) / 200);
  const costEff = model.cost ? Math.min(100, 100 - (model.cost.input + model.cost.output) / 2) : 50;
  
  return {
    // 推理能力
    reasoning: model.reasoning ? 80 : 60,
    logic: 70,
    
    // 感知
    vision: 60,
    perception: 65,
    
    // 记忆
    contextWindow: ctxNorm,
    shortMemory: 70,
    
    // 技能
    coding: 75,
    creativity: model.reasoning ? 85 : 65,
    
    // 情感
    emotion: 70,
    
    // 输出
    output: maxTokNorm,
    
    // 效率
    efficiency: costEff,
    benchmark: benchmarkScores,
  };
}

// 获取模型描述
export async function getModelDescription(): Promise<string> {
  const model = await getCurrentModel();
  
  if (!model) return '未知模型';
  
  return `${model.name} (上下文: ${(model.contextWindow / 1000).toFixed(0)}K, 最大输出: ${model.maxTokens})`;
}
