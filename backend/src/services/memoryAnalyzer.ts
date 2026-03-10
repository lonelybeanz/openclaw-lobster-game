import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';
const MEMORY_DIR = join(OPENCLAW_DIR, 'workspace', 'memory');

export interface MemoryStats {
  // 浅层记忆 - 最近几天
  shallowCount: number;      // 日记数量
  shallowQuality: number;    // 清晰度
  shallowRecent: string[];   // 最近几天日期
  
  // 深层记忆 - 核心记忆
  deepCount: number;        // 核心文件数
  deepQuality: number;      // 有序度
  deepFiles: string[];      // 核心文件列表
  
  // 整体评估
  totalFiles: number;
  totalSize: number;
  organization: number;      // 组织结构评分
  completeness: number;      // 完整度
}

// 评估文件质量
function evaluateFile(content: string): number {
  let score = 0;
  
  // 有标题加分
  if (content.includes('#')) score += 20;
  
  // 有结构（列表）加分
  if (content.includes('- ') || content.includes('* ')) score += 20;
  
  // 有表格加分
  if (content.includes('|')) score += 15;
  
  // 有代码块加分
  if (content.includes('```')) score += 10;
  
  // 有标签加分
  if (content.includes('#') && content.includes('/')) score += 10;
  
  // 内容长度适中 (500-5000字)
  const len = content.length;
  if (len > 500 && len < 5000) score += 15;
  else if (len >= 5000) score += 10;
  
  return Math.min(100, score);
}

// 获取文件创建/修改时间
async function getFileAge(path: string): Promise<number> {
  try {
    const stats = await stat(path);
    const age = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    return age;
  } catch {
    return 999;
  }
}

export async function analyzeMemory(): Promise<MemoryStats> {
  const stats: MemoryStats = {
    shallowCount: 0,
    shallowQuality: 0,
    shallowRecent: [],
    deepCount: 0,
    deepQuality: 0,
    deepFiles: [],
    totalFiles: 0,
    totalSize: 0,
    organization: 0,
    completeness: 0,
  };
  
  try {
    const files = await readdir(MEMORY_DIR, { recursive: true });
    const allFiles = files.filter(f => 
      typeof f === 'string' && 
      (f.endsWith('.md') || f.endsWith('.json'))
    );
    
    stats.totalFiles = allFiles.length;
    
    // 分析浅层记忆（日期文件）
    const dateFiles = allFiles.filter(f => /\d{4}-\d{2}-\d{2}/.test(f));
    stats.shallowCount = dateFiles.length;
    
    // 获取最近7天的记忆
    const recentDates: string[] = [];
    let shallowQualitySum = 0;
    
    for (const file of dateFiles.slice(0, 7)) {
      try {
        const filePath = join(MEMORY_DIR, file);
        const content = await readFile(filePath, 'utf-8');
        const quality = evaluateFile(content);
        shallowQualitySum += quality;
        
        const age = await getFileAge(filePath);
        if (age < 7) {
          recentDates.push(file.toString().replace('.md', ''));
        }
      } catch {}
    }
    
    stats.shallowQuality = dateFiles.length > 0 ? Math.floor(shallowQualitySum / Math.min(dateFiles.length, 7)) : 50;
    stats.shallowRecent = recentDates.sort().slice(-5);
    
    // 分析深层记忆（核心文件）
    const coreFiles = ['MEMORY.md', 'HIGH_LEVEL_PROMPTS.md', 'USER.md', 'SOUL.md', 'AGENTS.md'];
    let deepQualitySum = 0;
    
    for (const coreFile of coreFiles) {
      try {
        const filePath = join(MEMORY_DIR, coreFile);
        const content = await readFile(filePath, 'utf-8');
        const quality = evaluateFile(content);
        deepQualitySum += quality;
        stats.deepFiles.push(coreFile);
      } catch {}
    }
    
    stats.deepCount = stats.deepFiles.length;
    stats.deepQuality = coreFiles.length > 0 ? Math.floor(deepQualitySum / coreFiles.length) : 50;
    
    // 计算总体评分
    stats.organization = Math.min(100, Math.floor(
      (stats.shallowQuality * 0.3) + 
      (stats.deepQuality * 0.4) + 
      (Math.min(100, stats.totalFiles * 10) * 0.3)
    ));
    
    // 完整度评估
    const hasMemory = allFiles.includes('MEMORY.md');
    const hasUser = allFiles.includes('USER.md');
    const hasSoul = allFiles.includes('SOUL.md');
    stats.completeness = Math.floor(((hasMemory ? 30 : 0) + (hasUser ? 30 : 0) + (hasSoul ? 40 : 0)));
    
  } catch (e) {
    console.error('Memory analysis error:', e);
  }
  
  return stats;
}
