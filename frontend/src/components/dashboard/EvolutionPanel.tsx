/**
 * 进化树面板 (Collaboration → Evolution)
 * 显示龙虾成长阶段和进化路径
 */

import type { EvolutionTreeMetrics, EvolutionNode, EvolutionStage } from '../../types/dashboard';

interface EvolutionPanelProps {
  data: EvolutionTreeMetrics;
  isActive?: boolean;
  onClick?: () => void;
}

const stageConfig: Record<EvolutionStage, { name: string; color: string; icon: string }> = {
  egg: { name: '蛋', color: '#fcd34d', icon: '🥚' },
  larva: { name: '幼体', color: '#fbbf24', icon: '🦐' },
  juvenile: { name: '若虫', color: '#f59e0b', icon: '🦞' },
  adult: { name: '成体', color: '#ea580c', icon: '🦀' },
  evolved: { name: '进化体', color: '#dc2626', icon: '🐉' },
};

function EvolutionNodeItem({ 
  node, 
  isLast 
}: { 
  node: EvolutionNode; 
  isLast: boolean;
}) {
  const stage = stageConfig[node.stage];
  
  return (
    <div className={`evolution-node ${node.unlocked ? 'unlocked' : 'locked'}`}>
      <div 
        className="node-connector"
        style={{ 
          background: node.unlocked 
            ? `linear-gradient(to bottom, ${stage.color}, ${stage.color}80)` 
            : '#374151'
        }}
      />
      <div 
        className="node-circle"
        style={{ 
          background: node.unlocked 
            ? `linear-gradient(135deg, ${stage.color}, ${stage.color}80)` 
            : '#1f2937',
          borderColor: node.unlocked ? stage.color : '#4b5563',
          boxShadow: node.unlocked ? `0 0 15px ${stage.color}50` : 'none'
        }}
      >
        <span className="node-icon">{node.unlocked ? node.icon : '🔒'}</span>
        {node.unlocked && <span className="node-glow" style={{ background: stage.color }} />}
      </div>
      <div className="node-info">
        <span className="node-name">{node.name}</span>
        <span className="node-stage" style={{ color: stage.color }}>{stage.name}</span>
        {node.unlocked && node.completedAt && (
          <span className="node-date">
            {new Date(node.completedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function EvolutionPanel({ data, isActive, onClick }: EvolutionPanelProps) {
  const { currentStage, nodes, totalUnlocked, nextUnlockProgress } = data;
  const currentStageConfig = stageConfig[currentStage];

  // 找到当前阶段的节点
  const currentNodes = nodes.filter(n => n.stage === currentStage && n.unlocked);
  const nextNodes = nodes.filter(n => !n.unlocked).slice(0, 2);

  return (
    <div 
      className={`dashboard-card evolution-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div 
          className="card-icon" 
          style={{ background: `linear-gradient(135deg, ${currentStageConfig.color}, ${currentStageConfig.color}80)` }}
        >
          🧬
        </div>
        <div className="card-title">
          <h3>进化之路</h3>
          <span className="card-subtitle">Evolution Path</span>
        </div>
        <div 
          className="stage-badge"
          style={{ background: `${currentStageConfig.color}30`, color: currentStageConfig.color }}
        >
          {currentStageConfig.icon} {currentStageConfig.name}
        </div>
      </div>

      <div className="card-body">
        {/* 进化进度 */}
        <div className="evolution-progress">
          <div className="progress-header">
            <span>进化进度</span>
            <span>{totalUnlocked} / {nodes.length} 节点</span>
          </div>
          <div className="progress-bar evolution-bar">
            <div 
              className="progress-fill evolution-fill"
              style={{ 
                width: `${(totalUnlocked / nodes.length) * 100}%`,
                background: `linear-gradient(90deg, ${currentStageConfig.color}, ${currentStageConfig.color}80)`
              }}
            />
          </div>
          <div className="next-unlock">
            <span>下个解锁: {nextUnlockProgress}%</span>
            <div className="mini-bar">
              <div 
                className="mini-fill"
                style={{ width: `${nextUnlockProgress}%`, background: currentStageConfig.color }}
              />
            </div>
          </div>
        </div>

        {/* 进化时间线 */}
        <div className="evolution-timeline">
          {currentNodes.slice(-2).map((node, idx) => (
            <EvolutionNodeItem 
              key={node.id} 
              node={node} 
              isLast={idx === currentNodes.length - 1 && nextNodes.length === 0}
            />
          ))}
          {nextNodes.length > 0 && (
            <>
              <div className="timeline-ellipsis">···</div>
              {nextNodes.map((node) => (
                <EvolutionNodeItem 
                  key={node.id} 
                  node={node} 
                  isLast={false}
                />
              ))}
            </>
          )}
        </div>

        {/* 阶段指示器 */}
        <div className="stage-indicators">
          {(['egg', 'larva', 'juvenile', 'adult', 'evolved'] as EvolutionStage[]).map((stage) => {
            const config = stageConfig[stage];
            const isCurrent = stage === currentStage;
            const isPast = ['egg', 'larva', 'juvenile', 'adult', 'evolved'].indexOf(stage) < 
                          ['egg', 'larva', 'juvenile', 'adult', 'evolved'].indexOf(currentStage);
            
            return (
              <div 
                key={stage} 
                className={`stage-dot ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                style={{ 
                  background: isCurrent || isPast ? config.color : '#374151',
                  boxShadow: isCurrent ? `0 0 10px ${config.color}` : 'none'
                }}
                title={config.name}
              >
                <span>{config.icon}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 扩展内容 */}
      {isActive && (
        <div className="card-expanded">
          <h4>完整进化树</h4>
          <div className="full-evolution-tree">
            {nodes.map((node) => (
              <div key={node.id} className={`tree-node-full ${node.unlocked ? 'unlocked' : 'locked'}`}>
                <span className="tree-icon">{node.unlocked ? node.icon : '🔒'}</span>
                <div className="tree-info">
                  <span className="tree-name">{node.name}</span>
                  <span className="tree-desc">{node.description}</span>
                </div>
                {node.rewards && (
                  <span className="tree-reward">+{node.rewards.exp} EXP</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
