import { useEffect, useState } from 'react';
import { getAchievements, getLlmMilestones } from '../api';
import type { Achievement, LlmMilestonesResponse } from '../types';

const CATEGORY_META = {
  brain: { label: '脑力', icon: '🧠', tint: '#7dd3fc', glow: 'rgba(125, 211, 252, 0.35)' },
  skill: { label: '技能', icon: '🛠️', tint: '#86efac', glow: 'rgba(134, 239, 172, 0.35)' },
  explore: { label: '探索', icon: '🧭', tint: '#f9a8d4', glow: 'rgba(249, 168, 212, 0.35)' },
  social: { label: '社交', icon: '💬', tint: '#fcd34d', glow: 'rgba(252, 211, 77, 0.35)' },
  journey: { label: '心路历程', icon: '🌟', tint: '#a78bfa', glow: 'rgba(167, 139, 250, 0.35)' },
} as const;

type AchievementCategory = keyof typeof CATEGORY_META;

function getProgressPercent(achievement: Achievement) {
  if (!achievement.max || achievement.max <= 0) return achievement.unlocked ? 100 : 0;
  return Math.min(100, Math.round(((achievement.progress || 0) / achievement.max) * 100));
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebratingIds, setCelebratingIds] = useState<string[]>([]);
  const [llmData, setLlmData] = useState<LlmMilestonesResponse | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);

  useEffect(() => {
    getAchievements()
      .then((data) => {
        setAchievements(data);
        setCelebratingIds(data.filter((item) => item.unlocked).map((item) => item.id));
      })
      .finally(() => setLoading(false));
    
    // 加载 LLM 动态成就
    getLlmMilestones()
      .then((data) => setLlmData(data))
      .catch(() => setLlmLoading(false))
      .finally(() => setLlmLoading(false));
  }, []);

  useEffect(() => {
    if (celebratingIds.length === 0) return;
    const timer = window.setTimeout(() => setCelebratingIds([]), 2200);
    return () => window.clearTimeout(timer);
  }, [celebratingIds]);

  const unlocked = achievements.filter(a => a.unlocked).length;
  const total = achievements.length;
  const overallPercent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  const groupedAchievements = {
    brain: [] as Achievement[],
    skill: [] as Achievement[],
    explore: [] as Achievement[],
    social: [] as Achievement[],
    journey: [] as Achievement[],
  };

  for (const achievement of achievements) {
    const category = achievement.category as AchievementCategory | undefined;
    if (category && category in groupedAchievements) {
      groupedAchievements[category].push(achievement);
    }
  }

  // 将 LLM 动态成就转换为标准成就格式并加入心路历程分类
  if (llmData?.cards) {
    groupedAchievements.journey = llmData.cards.map((card) => ({
      id: `llm-${card.id}`,
      name: `${card.icon} ${card.name}`,
      description: `${card.headline}\n${card.description}`,
      category: 'journey',
      unlocked: card.unlocked,
      progress: card.progress,
      max: card.maxProgress,
      icon: card.icon,
    }));
  }

  // 计算总成就数（包含 LLM 成就）
  const llmUnlocked = llmData?.cards.filter(c => c.unlocked).length || 0;
  const llmTotal = llmData?.cards.length || 0;
  const totalAll = total + llmTotal;
  const unlockedAll = unlocked + llmUnlocked;
  const overallPercentAll = totalAll > 0 ? Math.round((unlockedAll / totalAll) * 100) : 0;

  return (
    <div className="page-shell" style={{ padding: '20px' }}>
      <style>{`
        @keyframes achievement-pop {
          0% { transform: scale(0.92); opacity: 0.65; }
          45% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes achievement-shine {
          0% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 0 28px rgba(255,255,255,0.16); }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
        }
      `}</style>
      <h1>🏆 成就系统</h1>
      
      <div style={{ 
        background: 'linear-gradient(135deg, #0f172a, #1d4ed8 55%, #7c3aed)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        <h2 style={{ margin: 0 }}>{unlockedAll} / {totalAll}</h2>
        <p style={{ margin: '6px 0 12px', opacity: 0.84 }}>已解锁成就</p>
        <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${overallPercentAll}%`,
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #67e8f9, #a78bfa, #f9a8d4)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '13px', opacity: 0.78 }}>总体完成度 {overallPercentAll}%</p>
      </div>

      {(loading || llmLoading) ? (
        <p>加载中...</p>
      ) : (
        <div style={{ display: 'grid', gap: '18px' }}>
          {(Object.keys(CATEGORY_META) as AchievementCategory[]).map((category) => {
            const items = groupedAchievements[category];
            const unlockedCount = items.filter((item) => item.unlocked).length;
            const categoryPercent = items.length > 0 ? Math.round((unlockedCount / items.length) * 100) : 0;
            const meta = CATEGORY_META[category];

            return (
              <section
                key={category}
                style={{
                  padding: '18px',
                  borderRadius: '18px',
                  border: `1px solid ${meta.glow}`,
                  background: `linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.72)), ${meta.glow}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>
                      {meta.icon} {meta.label}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '13px', opacity: 0.76 }}>
                      {unlockedCount} / {items.length} 已完成
                    </div>
                  </div>
                  <div style={{ minWidth: '180px', flex: '1 1 220px' }}>
                    <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${categoryPercent}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: `linear-gradient(90deg, ${meta.tint}, rgba(255,255,255,0.95))`,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {items.map((achievement) => {
                    const progressPercent = getProgressPercent(achievement);
                    const isCelebrating = celebratingIds.includes(achievement.id);

                    return (
                      <div
                        key={achievement.id}
                        style={{
                          padding: '16px',
                          borderRadius: '14px',
                          background: achievement.unlocked
                            ? `linear-gradient(135deg, ${meta.glow}, rgba(255,255,255,0.08))`
                            : 'rgba(255,255,255,0.04)',
                          border: achievement.unlocked
                            ? `1px solid ${meta.tint}`
                            : '1px solid rgba(255,255,255,0.08)',
                          opacity: achievement.unlocked ? 1 : 0.72,
                          transform: achievement.unlocked ? 'translateY(-1px)' : 'none',
                          animation: isCelebrating ? 'achievement-pop 0.55s ease, achievement-shine 1.4s ease' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ fontSize: '26px' }}>{achievement.icon || (achievement.unlocked ? '🏅' : '🔒')}</div>
                          <div
                            style={{
                              padding: '4px 8px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              background: achievement.unlocked ? meta.glow : 'rgba(255,255,255,0.06)',
                            }}
                          >
                            {achievement.unlocked ? '已解锁' : '进行中'}
                          </div>
                        </div>
                        <p style={{ margin: '12px 0 4px', fontWeight: 700 }}>{achievement.name}</p>
                        <p style={{ margin: 0, minHeight: '40px', fontSize: '13px', lineHeight: 1.5, opacity: 0.78 }}>
                          {achievement.description}
                        </p>
                        <div style={{ marginTop: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.72, marginBottom: '6px' }}>
                            <span>进度</span>
                            <span>{achievement.progress || 0} / {achievement.max || 0}</span>
                          </div>
                          <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                borderRadius: '999px',
                                background: achievement.unlocked
                                  ? `linear-gradient(90deg, ${meta.tint}, #ffffff)`
                                  : `linear-gradient(90deg, ${meta.tint}, rgba(255,255,255,0.4))`,
                                transition: 'width 0.6s ease',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
