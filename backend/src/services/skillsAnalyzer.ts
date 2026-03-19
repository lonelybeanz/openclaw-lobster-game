import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const OPENCLAW_DIR = '/Users/moltbot/.openclaw';
const SKILLS_DIR = join(OPENCLAW_DIR, 'skills');

export interface Skill {
  name: string;
  description: string;
  category: string;
}

export interface SkillsStats {
  total: number;
  skills: Skill[];
  categories: string[];
  recentlyAdded: string[];
}

// 技能分类
function categorizeSkill(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('code') || n.includes('coding')) return '开发';
  if (n.includes('memory')) return '记忆';
  if (n.includes('github') || n.includes('git')) return '版本';
  if (n.includes('weather')) return '工具';
  if (n.includes('health') || n.includes('security')) return '安全';
  if (n.includes('skill')) return '元技能';
  return '其他';
}

export async function analyzeSkills(): Promise<SkillsStats> {
  const skills: Skill[] = [];
  const categories = new Set<string>();
  const recentlyAdded: string[] = [];
  
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'README.md') continue;
      
      const skillDir = join(SKILLS_DIR, entry.name);
      const skillFile = join(skillDir, 'SKILL.md');
      
      try {
        const content = await readFile(skillFile, 'utf-8');
        const lines = content.split('\n');
        
        // 提取名称
        const titleLine = lines.find(l => l.startsWith('# '));
        const name = titleLine?.replace('# ', '').trim() || entry.name;
        
        // 提取描述
        const descLine = lines.find(l => l.length > 20 && !l.startsWith('#'));
        const description = descLine?.trim().substring(0, 100) || '暂无描述';
        
        const category = categorizeSkill(name);
        categories.add(category);
        
        skills.push({ name, description, category });
        
        // 简单判断最近添加（名称包含数字或新关键字）
        if (name.includes('2026') || name.includes('hook')) {
          recentlyAdded.push(name);
        }
      } catch {}
    }
  } catch (e) {
    console.error('Skills analysis error:', e);
  }
  
  return {
    total: skills.length,
    skills,
    categories: Array.from(categories),
    recentlyAdded: recentlyAdded.slice(0, 5)
  };
}
