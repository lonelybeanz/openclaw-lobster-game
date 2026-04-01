/**
 * Dialogue Tracker - 实时对话内容跟踪
 * 
 * 解析 OpenClaw session 文件，提取对话内容
 * - 用户请求分析
 * - AI 响应跟踪
 * - 工具调用链追踪
 * - 意图识别
 */

import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/Users/moltbot/.openclaw';

// 对话消息类型
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface DialogueMessage {
  id: string;
  sessionId: string;
  agentId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    model?: string;
    tokens?: number;
  };
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 工具结果
export interface ToolResult {
  toolCallId: string;
  output: string;
  success: boolean;
}

// 对话会话
export interface DialogueSession {
  id: string;
  agentId: string;
  messages: DialogueMessage[];
  startTime: Date;
  lastActivity: Date;
  summary?: string;
  status: 'active' | 'completed' | 'error';
}

// 用户意图
export interface UserIntent {
  type: 'coding' | 'debug' | 'planning' | 'research' | 'writing' | 'review' | 'general';
  confidence: number;
  keywords: string[];
  entities: string[];
}

// 对话统计
export interface DialogueStats {
  totalSessions: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  avgSessionLength: number;
  topIntents: { intent: string; count: number }[];
  topTools: { tool: string; count: number }[];
}

export class DialogueTracker extends EventEmitter {
  private sessions: Map<string, DialogueSession> = new Map();
  private activeStreams: Map<string, any> = new Map();
  private isTracking = false;

  /**
   * 开始跟踪所有 agent 的对话
   */
  async start(): Promise<void> {
    if (this.isTracking) return;
    this.isTracking = true;

    // 获取所有 agent
    const agents = await this.getAllAgents();
    
    for (const agentId of agents) {
      await this.trackAgent(agentId);
    }

    console.log('[DialogueTracker] Started tracking', agents.length, 'agents');
  }

  /**
   * 停止跟踪
   */
  stop(): void {
    this.isTracking = false;
    for (const [agentId, stream] of this.activeStreams) {
      stream.destroy?.();
      console.log('[DialogueTracker] Stopped tracking', agentId);
    }
    this.activeStreams.clear();
  }

  /**
   * 获取所有 agent
   */
  private async getAllAgents(): Promise<string[]> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const agentsPath = join(OPENCLAW_DIR, 'agents');
      const { stdout } = await execAsync(`ls -1 ${agentsPath} 2>/dev/null`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 跟踪单个 agent 的对话
   */
  private async trackAgent(agentId: string): Promise<void> {
    const sessionsDir = join(OPENCLAW_DIR, 'agents', agentId, 'sessions');
    
    // 初始化 agent 会话
    this.sessions.set(agentId, {
      id: `session-${agentId}-${Date.now()}`,
      agentId,
      messages: [],
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
    });
  }

  /**
   * 解析 session 文件
   */
  async parseSessionFile(agentId: string, filePath: string): Promise<DialogueMessage[]> {
    const messages: DialogueMessage[] = [];
    const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';

    try {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const record = JSON.parse(line);
          const message = this.parseRecord(agentId, sessionId, record);
          if (message) {
            messages.push(message);
          }
        } catch {
          // 忽略解析错误的行
        }
      }

      rl.close();
      fileStream.destroy();
    } catch (error) {
      console.error('[DialogueTracker] Parse error:', error);
    }

    return messages;
  }

  /**
   * 解析单条记录
   */
  private parseRecord(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    const type = record.type;

    switch (type) {
      case 'message':
        return this.parseMessage(agentId, sessionId, record);
      case 'tool_call':
        return this.parseToolCall(agentId, sessionId, record);
      case 'tool_result':
        return this.parseToolResult(agentId, sessionId, record);
      case 'session':
        // Session 开始/结束标记
        return null;
      default:
        return null;
    }
  }

  /**
   * 解析消息
   */
  private parseMessage(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    const message = record.message;
    if (!message) return null;

    const role = this.mapRole(message.role);
    const content = this.extractContent(message.content);

    return {
      id: record.id || `msg-${Date.now()}-${Math.random()}`,
      sessionId,
      agentId,
      role,
      content,
      timestamp: new Date(record.timestamp || Date.now()),
      metadata: {
        model: record.model,
        tokens: record.tokens,
      },
    };
  }

  /**
   * 解析工具调用
   */
  private parseToolCall(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    const toolCall = record.toolCall || record.tool_call;
    if (!toolCall) return null;

    return {
      id: record.id || `tool-${Date.now()}`,
      sessionId,
      agentId,
      role: 'tool',
      content: `调用工具: ${toolCall.name}`,
      timestamp: new Date(record.timestamp || Date.now()),
      metadata: {
        toolCalls: [{
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments || {},
        }],
      },
    };
  }

  /**
   * 解析工具结果
   */
  private parseToolResult(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    const result = record.toolResult || record.tool_result;
    if (!result) return null;

    return {
      id: record.id || `result-${Date.now()}`,
      sessionId,
      agentId,
      role: 'tool',
      content: `工具结果: ${result.output?.slice(0, 100) || '完成'}...`,
      timestamp: new Date(record.timestamp || Date.now()),
      metadata: {
        toolResults: [{
          toolCallId: result.toolCallId,
          output: result.output,
          success: !result.error,
        }],
      },
    };
  }

  /**
   * 映射角色
   */
  private mapRole(role: string): MessageRole {
    switch (role) {
      case 'user': return 'user';
      case 'assistant': return 'assistant';
      case 'system': return 'system';
      case 'tool': return 'tool';
      default: return 'assistant';
    }
  }

  /**
   * 提取内容
   */
  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map(c => {
        if (typeof c === 'string') return c;
        if (c.text) return c.text;
        if (c.type === 'image') return '[图片]';
        return '';
      }).join(' ');
    }
    return '';
  }

  /**
   * 分析用户意图
   */
  analyzeIntent(content: string): UserIntent {
    const lower = content.toLowerCase();
    
    // 意图模式匹配
    const patterns: Record<string, RegExp[]> = {
      coding: [/\b(code|function|class|implement|write.*code|develop|build|create.*app)\b/i],
      debug: [/\b(debug|fix|error|bug|issue|problem|broken|not working|fail)\b/i],
      planning: [/\b(plan|design|architecture|structure|organize|roadmap|schedule)\b/i],
      research: [/\b(research|investigate|study|learn|understand|explore|analyze)\b/i],
      writing: [/\b(write|document|doc|readme|article|blog|description)\b/i],
      review: [/\b(review|check|audit|inspect|evaluate|assess)\b/i],
    };

    // 计算各意图的匹配度
    const scores: Record<string, number> = {};
    for (const [intent, regexes] of Object.entries(patterns)) {
      scores[intent] = regexes.reduce((sum, regex) => sum + (regex.test(lower) ? 1 : 0), 0);
    }

    // 找出最高分的意图
    let maxIntent: string = 'general';
    let maxScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent;
      }
    }

    // 提取关键词
    const keywords = this.extractKeywords(content);
    
    // 提取实体（简化版）
    const entities = this.extractEntities(content);

    return {
      type: maxIntent as UserIntent['type'],
      confidence: Math.min(maxScore / 2, 1),
      keywords,
      entities,
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
    
    return content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 5);
  }

  /**
   * 提取实体
   */
  private extractEntities(content: string): string[] {
    // 简单的实体提取：文件名、函数名、类名等
    const entities: string[] = [];
    
    // 匹配文件名
    const fileMatches = content.match(/\b[\w-]+\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|h)\b/g);
    if (fileMatches) entities.push(...fileMatches);
    
    // 匹配函数/类名（驼峰或下划线）
    const nameMatches = content.match(/\b([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*_[a-z0-9_]+)\b/g);
    if (nameMatches) entities.push(...nameMatches.slice(0, 3));
    
    return [...new Set(entities)].slice(0, 5);
  }

  /**
   * 生成对话摘要
   */
  generateSummary(messages: DialogueMessage[]): string {
    if (messages.length === 0) return '无对话内容';

    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    
    if (lastUserMessage) {
      const intent = this.analyzeIntent(lastUserMessage.content);
      return `${intent.type}: ${lastUserMessage.content.slice(0, 50)}...`;
    }

    return '进行中...';
  }

  /**
   * 获取 agent 的最新对话
   */
  getAgentDialogue(agentId: string, limit: number = 10): DialogueMessage[] {
    const session = this.sessions.get(agentId);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  /**
   * 获取对话统计
   */
  getStats(): DialogueStats {
    let totalMessages = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    let toolCalls = 0;
    const intentCounts: Record<string, number> = {};
    const toolCounts: Record<string, number> = {};

    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
      
      for (const msg of session.messages) {
        if (msg.role === 'user') {
          userMessages++;
          const intent = this.analyzeIntent(msg.content);
          intentCounts[intent.type] = (intentCounts[intent.type] || 0) + 1;
        } else if (msg.role === 'assistant') {
          assistantMessages++;
        } else if (msg.role === 'tool') {
          toolCalls++;
          if (msg.metadata?.toolCalls) {
            for (const tool of msg.metadata.toolCalls) {
              toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
            }
          }
        }
      }
    }

    const topIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count }));

    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    return {
      totalSessions: this.sessions.size,
      totalMessages,
      userMessages,
      assistantMessages,
      toolCalls,
      avgSessionLength: totalMessages / Math.max(this.sessions.size, 1),
      topIntents,
      topTools,
    };
  }

  /**
   * 获取最近活动
   */
  getRecentActivity(minutes: number = 5): DialogueMessage[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const activities: DialogueMessage[] = [];

    for (const session of this.sessions.values()) {
      for (const msg of session.messages) {
        if (msg.timestamp > cutoff) {
          activities.push(msg);
        }
      }
    }

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// 导出单例
export const dialogueTracker = new DialogueTracker();
