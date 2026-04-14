/**
 * Dialogue Tracker - 实时对话内容跟踪
 * 
 * 解析 OpenClaw session 文件，提取对话内容
 * - 用户请求分析
 * - AI 响应跟踪
 * - 工具调用链追踪
 * - 意图识别
 */

import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import { join } from 'path';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/Users/moltbot/.openclaw';

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

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  success: boolean;
}

export interface DialogueSession {
  id: string;
  agentId: string;
  messages: DialogueMessage[];
  startTime: Date;
  lastActivity: Date;
  summary?: string;
  status: 'active' | 'completed' | 'error';
}

export interface UserIntent {
  type: 'coding' | 'debug' | 'planning' | 'research' | 'writing' | 'review' | 'general';
  confidence: number;
  keywords: string[];
  entities: string[];
}

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

export interface DialogueSessionSummary {
  id: string;
  agentId: string;
  messageCount: number;
  startTime: Date;
  lastActivity: Date;
  summary: string;
  status: DialogueSession['status'];
}

export class DialogueTracker extends EventEmitter {
  private sessions: Map<string, DialogueSession> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private isTracking = false;

  async start(): Promise<void> {
    if (this.isTracking) return;
    this.isTracking = true;

    const agents = await this.getAllAgents();
    for (const agentId of agents) {
      await this.trackAgent(agentId);
    }

    console.log('[DialogueTracker] Started tracking', agents.length, 'agents');
  }

  stop(): void {
    this.isTracking = false;
    for (const [agentId, watcher] of this.watchers) {
      watcher.close();
      console.log('[DialogueTracker] Stopped tracking', agentId);
    }
    this.watchers.clear();
  }

  private async getAllAgents(): Promise<string[]> {
    try {
      const agentsPath = join(OPENCLAW_DIR, 'agents');
      const entries = await readdir(agentsPath, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private async trackAgent(agentId: string): Promise<void> {
    const sessionsDir = join(OPENCLAW_DIR, 'agents', agentId, 'sessions');

    await this.refreshLatestSession(agentId, sessionsDir);

    const watcher = watch(sessionsDir, {
      ignored: /(^|[\/])\../,
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1000,
    });

    watcher.on('add', (filePath) => {
      void this.handleSessionUpdate(agentId, filePath);
    });
    watcher.on('change', (filePath) => {
      void this.handleSessionUpdate(agentId, filePath);
    });
    watcher.on('unlink', () => {
      void this.refreshLatestSession(agentId, sessionsDir);
    });
    watcher.on('error', (error) => {
      console.error('[DialogueTracker] Watcher error:', agentId, error);
    });

    this.watchers.set(agentId, watcher);
  }

  private async refreshLatestSession(agentId: string, sessionsDir: string): Promise<void> {
    const latestFile = await this.findLatestSessionFile(sessionsDir);

    if (!latestFile) {
      this.sessions.set(agentId, {
        id: `session-${agentId}-empty`,
        agentId,
        messages: [],
        startTime: new Date(0),
        lastActivity: new Date(0),
        summary: '暂无对话',
        status: 'completed',
      });
      return;
    }

    await this.handleSessionUpdate(agentId, latestFile);
  }

  private async findLatestSessionFile(sessionsDir: string): Promise<string | null> {
    try {
      const files = await readdir(sessionsDir);
      const sessionFiles = files.filter((file) => file.endsWith('.jsonl') && !file.includes('.deleted') && !file.includes('.reset'));

      let latestFile: string | null = null;
      let latestMtime = 0;

      for (const file of sessionFiles) {
        const filePath = join(sessionsDir, file);
        try {
          const fileStat = await stat(filePath);
          if (fileStat.mtimeMs >= latestMtime) {
            latestMtime = fileStat.mtimeMs;
            latestFile = filePath;
          }
        } catch {
          // ignore per-file errors
        }
      }

      return latestFile;
    } catch {
      return null;
    }
  }

  private async handleSessionUpdate(agentId: string, filePath: string): Promise<void> {
    if (!filePath.endsWith('.jsonl') || filePath.includes('.deleted') || filePath.includes('.reset')) {
      return;
    }

    const previousSession = this.sessions.get(agentId);
    const messages = await this.parseSessionFile(agentId, filePath);
    const session = this.buildSession(agentId, filePath, messages);
    this.sessions.set(agentId, session);

    if (!previousSession || previousSession.id !== session.id) {
      this.emit('sessionChanged', { agentId, session });
    }

    const previousMessageIds = new Set(previousSession?.messages.map((message) => message.id) ?? []);
    const newMessages = session.messages.filter((message) => !previousMessageIds.has(message.id));
    for (const message of newMessages) {
      this.emit('message', { agentId, sessionId: session.id, message });
    }
  }

  private buildSession(agentId: string, filePath: string, messages: DialogueMessage[]): DialogueSession {
    const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || `session-${agentId}`;
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return {
      id: sessionId,
      agentId,
      messages,
      startTime: firstMessage?.timestamp ?? new Date(),
      lastActivity: lastMessage?.timestamp ?? firstMessage?.timestamp ?? new Date(),
      summary: this.generateSummary(messages),
      status: 'active',
    };
  }

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

  private parseRecord(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    if (record.type === 'message') {
      return this.parseMessage(agentId, sessionId, record);
    }

    switch (record.type) {
      case 'tool_call':
        return this.parseToolCall(agentId, sessionId, record);
      case 'tool_result':
        return this.parseToolResult(agentId, sessionId, record);
      case 'session':
        return null;
      default:
        return null;
    }
  }

  private parseMessage(agentId: string, sessionId: string, record: any): DialogueMessage | null {
    const message = record.message;
    if (!message) return null;

    const role = this.mapRole(message.role);
    const content = this.extractContent(message.content);
    const contentItems = Array.isArray(message.content) ? message.content : [];
    const toolCalls = contentItems
      .filter((item: any) => item?.type === 'toolCall' && item.name)
      .map((item: any) => ({
        id: item.id || `tool-${Date.now()}`,
        name: item.name,
        arguments: item.arguments || {},
      }));
    const toolResults = message.role === 'toolResult'
      ? [{
          toolCallId: message.toolCallId || `tool-result-${Date.now()}`,
          output: content,
          success: !message.isError,
        }]
      : [];

    return {
      id: record.id || `msg-${Date.now()}-${Math.random()}`,
      sessionId,
      agentId,
      role,
      content,
      timestamp: new Date(record.timestamp || Date.now()),
      metadata: {
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        model: record.model || message.model,
        tokens: record.tokens || record.usage?.totalTokens || message.usage?.totalTokens,
      },
    };
  }

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

  private mapRole(role: string): MessageRole {
    switch (role) {
      case 'user': return 'user';
      case 'assistant': return 'assistant';
      case 'system': return 'system';
      case 'tool':
      case 'toolResult':
        return 'tool';
      default: return 'assistant';
    }
  }

  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((c) => {
        if (typeof c === 'string') return c;
        if (c.text) return c.text;
        if (c.type === 'toolCall' && c.name) return `[工具调用:${c.name}]`;
        if (c.type === 'thinking') return '';
        if (c.type === 'image') return '[图片]';
        return '';
      }).filter(Boolean).join(' ');
    }
    return '';
  }

  analyzeIntent(content: string): UserIntent {
    const lower = content.toLowerCase();

    const patterns: Record<string, RegExp[]> = {
      coding: [/\b(code|function|class|implement|write.*code|develop|build|create.*app)\b/i],
      debug: [/\b(debug|fix|error|bug|issue|problem|broken|not working|fail)\b/i],
      planning: [/\b(plan|design|architecture|structure|organize|roadmap|schedule)\b/i],
      research: [/\b(research|investigate|study|learn|understand|explore|analyze)\b/i],
      writing: [/\b(write|document|doc|readme|article|blog|description)\b/i],
      review: [/\b(review|check|audit|inspect|evaluate|assess)\b/i],
    };

    const scores: Record<string, number> = {};
    for (const [intent, regexes] of Object.entries(patterns)) {
      scores[intent] = regexes.reduce((sum, regex) => sum + (regex.test(lower) ? 1 : 0), 0);
    }

    let maxIntent = 'general';
    let maxScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent;
      }
    }

    return {
      type: maxIntent as UserIntent['type'],
      confidence: Math.min(maxScore / 2, 1),
      keywords: this.extractKeywords(content),
      entities: this.extractEntities(content),
    };
  }

  private extractKeywords(content: string): string[] {
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);

    return content
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }

  private extractEntities(content: string): string[] {
    const entities: string[] = [];
    const fileMatches = content.match(/\b[\w-]+\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|h)\b/g);
    if (fileMatches) entities.push(...fileMatches);

    const nameMatches = content.match(/\b([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*_[a-z0-9_]+)\b/g);
    if (nameMatches) entities.push(...nameMatches.slice(0, 3));

    return [...new Set(entities)].slice(0, 5);
  }

  generateSummary(messages: DialogueMessage[]): string {
    if (messages.length === 0) return '无对话内容';

    const userMessages = messages.filter((message) => message.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (lastUserMessage) {
      const intent = this.analyzeIntent(lastUserMessage.content);
      return `${intent.type}: ${lastUserMessage.content.slice(0, 50)}...`;
    }

    return '进行中...';
  }

  getAgentDialogue(agentId: string, limit: number = 10): DialogueMessage[] {
    const session = this.sessions.get(agentId);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  getAllSessions(): DialogueSessionSummary[] {
    return [...this.sessions.values()]
      .sort((left, right) => right.lastActivity.getTime() - left.lastActivity.getTime())
      .map((session) => ({
        id: session.id,
        agentId: session.agentId,
        messageCount: session.messages.length,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        summary: session.summary || '暂无摘要',
        status: session.status,
      }));
  }

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

export const dialogueTracker = new DialogueTracker();
