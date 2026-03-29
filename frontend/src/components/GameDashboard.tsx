/**
 * OCC 游戏化仪表盘组件
 * 将 OpenClaw Control Center 的卡片数据转换为游戏化 UI
 */

import { useEffect, useState } from 'react';
import { getGameDashboard } from '../api';
import type { GameDashboardSnapshot } from '../types/dashboard';
import { HealthPanel } from './dashboard/HealthPanel';
import { EnergyPanel } from './dashboard/EnergyPanel';
import { CaretakerPanel } from './dashboard/CaretakerPanel';
import { AttentionPanel } from './dashboard/AttentionPanel';
import { EvolutionPanel } from './dashboard/EvolutionPanel';
import { MemoryPalacePanel } from './dashboard/MemoryPalacePanel';
import { HandbookPanel } from './dashboard/HandbookPanel';
import { TaskBoardPanel } from './dashboard/TaskBoardPanel';
import { FacilityPanel } from './dashboard/FacilityPanel';

import './GameDashboard.css';

interface GameDashboardProps {
  className?: string;
}

export default function GameDashboard({ className = '' }: GameDashboardProps) {
  const [snapshot, setSnapshot] = useState<GameDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const data = await getGameDashboard();
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // 每 30 秒自动刷新
    const interval = setInterval(() => {
      void loadDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !snapshot) {
    return (
      <div className={`game-dashboard loading ${className}`}>
        <div className="dashboard-loading">
          <div className="loading-lobster">🦞</div>
          <p>正在加载游戏仪表盘...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`game-dashboard error ${className}`}>
        <div className="dashboard-error">
          <div className="error-icon">⚠️</div>
          <p>加载失败：{error}</p>
          <button onClick={() => void loadDashboard()} className="retry-btn">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const { modules, overall } = snapshot;

  return (
    <div className={`game-dashboard ${className}`}>
      {/* 顶部总体状态栏 */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="game-logo">
            <span className="logo-icon">🎮</span>
            <div>
              <h1>龙虾养成中心</h1>
              <span className="subtitle">Lobster Game Dashboard</span>
            </div>
          </div>
          
          <div className="overall-stats">
            <div className="stat-item">
              <span className="stat-label">等级</span>
              <span className="stat-value level">Lv.{overall.gameLevel}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">游戏时长</span>
              <span className="stat-value">{overall.totalPlayTime} 天</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">总进度</span>
              <div className="progress-ring">
                <svg viewBox="0 0 36 36">
                  <path
                    className="progress-ring-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="progress-ring-fill"
                    strokeDasharray={`${overall.overallProgress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="progress-text">{overall.overallProgress}%</span>
              </div>
            </div>
            <div className="stat-item next-milestone">
              <span className="stat-label">下个目标</span>
              <span className="stat-value milestone">{overall.nextMilestone}</span>
            </div>
          </div>

          <button className="refresh-btn" onClick={() => void loadDashboard()} disabled={loading}>
            {loading ? '🔄' : '↻'}
          </button>
        </div>
      </header>

      {/* 游戏化卡片网格 */}
      <main className="dashboard-grid">
        {/* 第 1 行：核心状态 */}
        <div className="dashboard-row primary">
          <HealthPanel 
            data={modules.health} 
            isActive={activeCard === 'health'}
            onClick={() => setActiveCard(activeCard === 'health' ? null : 'health')}
          />
          <EnergyPanel 
            data={modules.energy}
            isActive={activeCard === 'energy'}
            onClick={() => setActiveCard(activeCard === 'energy' ? null : 'energy')}
          />
          <FacilityPanel 
            data={modules.facility}
            isActive={activeCard === 'facility'}
            onClick={() => setActiveCard(activeCard === 'facility' ? null : 'facility')}
          />
        </div>

        {/* 第 2 行：养殖师与关注列表 */}
        <div className="dashboard-row secondary">
          <CaretakerPanel 
            isActive={activeCard === 'caretaker'}
            onClick={() => setActiveCard(activeCard === 'caretaker' ? null : 'caretaker')}
          />
          <AttentionPanel 
            isActive={activeCard === 'attention'}
            onClick={() => setActiveCard(activeCard === 'attention' ? null : 'attention')}
          />
        </div>

        {/* 第 3 行：进化与记忆 */}
        <div className="dashboard-row tertiary">
          <EvolutionPanel 
            data={modules.evolution}
            isActive={activeCard === 'evolution'}
            onClick={() => setActiveCard(activeCard === 'evolution' ? null : 'evolution')}
          />
          <MemoryPalacePanel 
            data={modules.memory}
            isActive={activeCard === 'memory'}
            onClick={() => setActiveCard(activeCard === 'memory' ? null : 'memory')}
          />
        </div>

        {/* 第 4 行：手册（全宽） */}
        <div className="dashboard-row full-width">
          <HandbookPanel 
            data={modules.handbook}
            isActive={activeCard === 'handbook'}
            onClick={() => setActiveCard(activeCard === 'handbook' ? null : 'handbook')}
          />
        </div>

        {/* 第 5 行：任务板 */}
        <div className="dashboard-row full-width">
          <TaskBoardPanel 
            data={modules.tasks}
            isActive={activeCard === 'tasks'}
            onClick={() => setActiveCard(activeCard === 'tasks' ? null : 'tasks')}
          />
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="dashboard-footer">
        <span>版本 {snapshot.version}</span>
        <span>·</span>
        <span>更新于 {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}
