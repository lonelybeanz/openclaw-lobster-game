/**
 * Real-time OpenClaw Monitor
 * 
 * 实时监控系统，跟踪 OpenClaw agent 的活动
 * - 监控 session 文件变化
 * - 解析实时工作流
 * - 识别任务类型
 * - 检测协作关系
 */

import { watch, FSWatcher } from 'chokidar';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { EventEmitter } from 'events';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/Users/moltbot/.openclaw';

// 任务类型定义
export type TaskType = 
  | 'coding'      // 写代码、debug
  | 'planning'    // 写PRD、排期
  | 'research'    // 调研、读文档
  | 'review'      // Code Review
  | 'debug'       // 故障处理
  | 'meeting'     // 会议讨论
  | 'writing'     // 写文档
  | 'learning'    // 学习新技能
  | 'maintenance' // 维护工作
  | 'unknown';

// 工具使用记录
export interface ToolUsage {
  name: string;
  count: number;
  lastUsed: Date;
}

// 工作任务
export interface WorkTask {
  id: string;
  agentId: string;
  type: TaskType;
  description: string;
  status: 'active' | 'completed' | 'interrupted';
  startTime: Date;
  endTime?: Date;
  toolsUsed: ToolUsage[];
  tokenConsumed: number;
  collaborators: string[]; // 协作的 agent IDs
}

// Agent 实时状态
export interface AgentRealtimeState {
  agentId: string;
  status: 'working' | 'idle' | 'resting' | 'offline';
  currentTask?: WorkTask;
  todayTasks: WorkTask[];
  toolsUsed: ToolUsage[];
  lastActive: Date;
  efficiency: number; // 0-100
  burnoutRisk: number; // 0-100
}

// 协作事件
export interface CollaborationEvent {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: 'ask' | 'review' | 'handoff' | 'sync';
  topic: string;
  timestamp: Date;
  sessionId: string;
}

// 实时监控器类
export class RealtimeMonitor extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private agentStates: Map<string, AgentRealtimeState> = new Map();
  private activeTasks: Map<string, WorkTask> = new Map();
  private collaborationHistory: CollaborationEvent[] = [];
  private isRunning = false;

  constructor() {
    super();
  }

  /**
   * 开始监控所有 agent
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 获取所有 agent
    const agents = await this.getAllAgents();
    
    for (const agentId of agents) {
      await this.watchAgent(agentId);
      // 扫描现有 session 文件初始化状态
      await this.scanExistingSessions(agentId);
    }

    console.log('[RealtimeMonitor] Started watching', agents.length, 'agents');
    this.emit('started', { agentCount: agents.length });
  }

  /**
   * 扫描现有 session 文件
   */
  private async scanExistingSessions(agentId: string): Promise<void> {
    const sessionsDir = join(OPENCLAW_DIR, 'agents', agentId, 'sessions');
    
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(sessionsDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.reset'));
      
      const state = this.agentStates.get(agentId);
      if (!state) return;

      let totalTokens = 0;
      let lastActive = new Date(0);

      for (const file of jsonlFiles) {
        try {
          const filePath = join(sessionsDir, file);
          const stats = await stat(filePath);
          totalTokens += Math.floor(stats.size / 4);
          
          if (stats.mtime > lastActive) {
            lastActive = stats.mtime;
          }
        } catch {
          // 忽略错误
        }
      }

      // 更新状态
      if (jsonlFiles.length > 0) {
        state.todayTasks = jsonlFiles.map((_, i) => ({
          id: `session-${i}`,
          agentId,
          type: 'unknown',
          description: '历史会话',
          status: 'completed',
          startTime: lastActive,
          endTime: lastActive,
          toolsUsed: [],
          tokenConsumed: Math.floor(totalTokens / jsonlFiles.length),
          collaborators: [],
        }));
        state.lastActive = lastActive;
        
        // 如果最近有活动，标记为空闲而非离线
        const hoursSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          state.status = 'idle';
        }
      }

      this.emit('agentScanned', { agentId, sessionCount: jsonlFiles.length });
    } catch {
      // 目录不存在或无法读取
    }
  }

  /**
   * 停止监控
   */
  stop(): void {
    this.isRunning = false;
    for (const [agentId, watcher] of this.watchers) {
      watcher.close();
      console.log('[RealtimeMonitor] Stopped watching', agentId);
    }
    this.watchers.clear();
    this.emit('stopped');
  }

  /**
   * 获取所有 agent 列表
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
   * 监控单个 agent
   */
  private async watchAgent(agentId: string): Promise<void> {
    const sessionsDir = join(OPENCLAW_DIR, 'agents', agentId, 'sessions');
    
    // 初始化状态
    this.agentStates.set(agentId, {
      agentId,
      status: 'offline',
      todayTasks: [],
      toolsUsed: [],
      lastActive: new Date(0),
      efficiency: 100,
      burnoutRisk: 0,
    });

    // 创建文件监听器
    const watcher = watch(sessionsDir, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      usePolling: true,
      interval: 1000, // 每秒检查一次
    });

    watcher.on('add', (path) => this.handleNewSession(agentId, path));
    watcher.on('change', (path) => this.handleSessionChange(agentId, path));
    
    this.watchers.set(agentId, watcher);
  }

  /**
   * 处理新 session 文件
   */
  private async handleNewSession(agentId: string, filePath: string): Promise<void> {
    if (!filePath.endsWith('.jsonl') || filePath.includes('.deleted')) return;
    
    console.log('[RealtimeMonitor] New session:', agentId, filePath);
    
    // 解析 session 获取初始信息
    const sessionInfo = await this.parseSessionFile(filePath);
    
    // 创建新任务
    const task: WorkTask = {
      id: `task-${Date.now()}`,
      agentId,
      type: 'unknown',
      description: '开始新工作',
      status: 'active',
      startTime: new Date(),
      toolsUsed: [],
      tokenConsumed: 0,
      collaborators: [],
    };
    
    this.activeTasks.set(agentId, task);
    
    // 更新 agent 状态
    const state = this.agentStates.get(agentId)!;
    state.status = 'working';
    state.currentTask = task;
    state.lastActive = new Date();
    
    this.emit('taskStarted', { agentId, task });
    this.emit('agentStatusChanged', { agentId, status: 'working' });
  }

  /**
   * 处理 session 文件变化（新内容追加）
   */
  private async handleSessionChange(agentId: string, filePath: string): Promise<void> {
    if (!filePath.endsWith('.jsonl') || filePath.includes('.deleted')) return;
    
    const updates = await this.parseSessionUpdates(filePath);
    const task = this.activeTasks.get(agentId);
    
    if (!task) return;

    for (const update of updates) {
      await this.processUpdate(agentId, task, update);
    }
  }

  /**
   * 解析 session 文件
   */
  private async parseSessionFile(filePath: string): Promise<any> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length === 0) return null;
      
      return JSON.parse(lines[0]);
    } catch {
      return null;
    }
  }

  /**
   * 解析 session 更新
   */
  private async parseSessionUpdates(filePath: string): Promise<any[]> {
    try {
      const stats = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      return lines.slice(-5) // 只取最后5行（最新活动）
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 处理单个更新
   */
  private async processUpdate(agentId: string, task: WorkTask, update: any): Promise<void> {
    const type = update.type;
    
    switch (type) {
      case 'message':
        await this.processMessage(agentId, task, update);
        break;
      case 'tool_call':
        this.processToolCall(agentId, task, update);
        break;
      case 'thinking_level_change':
        // 记录思考深度变化
        break;
      case 'session':
        // Session 开始/结束
        if (update.endTime) {
          this.completeTask(agentId, task);
        }
        break;
    }
  }

  /**
   * 处理消息
   */
  private async processMessage(agentId: string, task: WorkTask, update: any): Promise<void> {
    const message = update.message || {};
    const content = this.extractContent(message);
    
    // 识别任务类型
    if (task.type === 'unknown') {
      task.type = this.identifyTaskType(content);
      task.description = this.generateTaskDescription(task.type, content);
    }
    
    // 检测跨 agent 协作
    const collaborator = this.detectCollaboration(content);
    if (collaborator && !task.collaborators.includes(collaborator)) {
      task.collaborators.push(collaborator);
      this.recordCollaboration(agentId, collaborator, task);
    }
    
    // 更新 token 消耗（估算）
    task.tokenConsumed += Math.floor(content.length / 4);
    
    // 通知更新
    this.emit('taskUpdated', { agentId, task, update: { type: 'message', content } });
  }

  /**
   * 处理工具调用
   */
  private processToolCall(agentId: string, task: WorkTask, update: any): void {
    const toolName = update.toolCall?.name || update.tool || 'unknown';
    
    // 更新任务的工具使用
    const existing = task.toolsUsed.find(t => t.name === toolName);
    if (existing) {
      existing.count++;
      existing.lastUsed = new Date();
    } else {
      task.toolsUsed.push({
        name: toolName,
        count: 1,
      lastUsed: new Date(),
      });
    }
    
    // 更新 agent 的工具统计
    const state = this.agentStates.get(agentId)!;
    const stateTool = state.toolsUsed.find(t => t.name === toolName);
    if (stateTool) {
      stateTool.count++;
      stateTool.lastUsed = new Date();
    } else {
      state.toolsUsed.push({
        name: toolName,
        count: 1,
        lastUsed: new Date(),
      });
    }
    
    this.emit('toolUsed', { agentId, toolName, taskId: task.id });
  }

  /**
   * 识别任务类型
   */
  private identifyTaskType(content: string): TaskType {
    const lower = content.toLowerCase();
    
    // 代码相关
    if (/\b(code|function|bug|debug|error|fix|implement|refactor|class|const|let|var|import|export)\b/.test(lower)) {
      return 'coding';
    }
    
    // 规划相关
    if (/\b(prd|plan|schedule|roadmap|milestone|requirement|spec|设计|规划|排期)\b/.test(lower)) {
      return 'planning';
    }
    
    // 调研相关
    if (/\b(research|investigate|study|learn|read|survey|analyze|调研|研究|学习)\b/.test(lower)) {
      return 'research';
    }
    
    // Review 相关
    if (/\b(review|audit|check|inspect|approve|pr|mr|审查|检查)\b/.test(lower)) {
      return 'review';
    }
    
    // Debug 相关
    if (/\b(debug| troubleshoot|diagnose|fix.*error|解决.*问题|排查)\b/.test(lower)) {
      return 'debug';
    }
    
    // 文档相关
    if (/\b(document|doc|write|article|blog|readme|文档|文章|写作)\b/.test(lower)) {
      return 'writing';
    }
    
    // 学习相关
    if (/\b(learn|tutorial|course|practice|exercise|学习|练习|教程)\b/.test(lower)) {
      return 'learning';
    }
    
    // 维护相关
    if (/\b(maintain|upgrade|update|sync|backup|clean|维护|升级|同步|备份)\b/.test(lower)) {
      return 'maintenance';
    }
    
    return 'unknown';
  }

  /**
   * 生成任务描述
   */
  private generateTaskDescription(type: TaskType, content: string): string {
    const keywords = this.extractKeywords(content, 5);
    
    const typeNames: Record<TaskType, string> = {
      coding: '编写代码',
      planning: '规划工作',
      research: '调研分析',
      review: '审查代码',
      debug: '调试修复',
      meeting: '会议讨论',
      writing: '撰写文档',
      learning: '学习提升',
      maintenance: '系统维护',
      unknown: '处理任务',
    };
    
    return `${typeNames[type]}: ${keywords}`;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string, count: number): string {
    // 简单的关键词提取
    const words = content
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|man|new|now|old|see|two|way|who|boy|did|its|let|put|say|she|too|use)$/.test(w.toLowerCase()))
      .slice(0, count);
    
    return words.join(', ') || '一般工作';
  }

  /**
   * 提取消息内容
   */
  private extractContent(message: any): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content.map((c: any) => c.text || '').join(' ');
    }
    return '';
  }

  /**
   * 检测协作
   */
  private detectCollaboration(content: string): string | null {
    const lower = content.toLowerCase();
    
    // 检查是否提到其他 agent
    const agents = ['dev', 'pm', 'main', 'ops', 'research', 'lobster'];
    for (const agent of agents) {
      if (lower.includes(`@${agent}`) || lower.includes(`agent ${agent}`) || lower.includes(`${agent} agent`)) {
        return agent;
      }
    }
    
    return null;
  }

  /**
   * 记录协作
   */
  private recordCollaboration(from: string, to: string, task: WorkTask): void {
    const event: CollaborationEvent = {
      id: `collab-${Date.now()}`,
      fromAgent: from,
      toAgent: to,
      type: 'sync',
      topic: task.description,
      timestamp: new Date(),
      sessionId: task.id,
    };
    
    this.collaborationHistory.push(event);
    this.emit('collaboration', event);
  }

  /**
   * 完成任务
   */
  private completeTask(agentId: string, task: WorkTask): void {
    task.status = 'completed';
    task.endTime = new Date();
    
    // 移动到今日任务列表
    const state = this.agentStates.get(agentId)!;
    state.todayTasks.push(task);
    state.currentTask = undefined;
    state.status = 'idle';
    
    this.activeTasks.delete(agentId);
    
    this.emit('taskCompleted', { agentId, task });
    this.emit('agentStatusChanged', { agentId, status: 'idle' });
  }

  // ============ Public APIs ============

  /**
   * 获取所有 agent 的实时状态
   */
  getAllAgentStates(): AgentRealtimeState[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * 获取单个 agent 状态
   */
  getAgentState(agentId: string): AgentRealtimeState | undefined {
    return this.agentStates.get(agentId);
  }

  /**
   * 获取活跃任务
   */
  getActiveTasks(): WorkTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * 获取今日统计
   */
  getTodayStats(): {
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    totalTokens: number;
    collaborations: number;
    toolUsage: Record<string, number>;
  } {
    const allTasks = Array.from(this.agentStates.values())
      .flatMap(s => s.todayTasks);
    
    const toolUsage: Record<string, number> = {};
    
    for (const state of this.agentStates.values()) {
      for (const tool of state.toolsUsed) {
        toolUsage[tool.name] = (toolUsage[tool.name] || 0) + tool.count;
      }
    }
    
    return {
      totalTasks: allTasks.length + this.activeTasks.size,
      completedTasks: allTasks.filter(t => t.status === 'completed').length,
      activeTasks: this.activeTasks.size,
      totalTokens: allTasks.reduce((sum, t) => sum + t.tokenConsumed, 0),
      collaborations: this.collaborationHistory.length,
      toolUsage,
    };
  }

  /**
   * 获取协作历史
   */
  getCollaborationHistory(): CollaborationEvent[] {
    return this.collaborationHistory;
  }
}

// 导出单例
export const realtimeMonitor = new RealtimeMonitor();
