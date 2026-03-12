import { useEffect, useState } from 'react';
import { getAchievements } from '../api';
import type { Achievement } from '../types';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAchievements()
      .then(setAchievements)
      .finally(() => setLoading(false));
  }, []);

  const unlocked = achievements.filter(a => a.unlocked).length;
  const total = achievements.length;

  return (
    <div className="page-shell" style={{ padding: '20px' }}>
      <h1>🏆 成就系统</h1>
      
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea, #764ba2)', 
        padding: '20px', 
        borderRadius: '16px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: 0 }}>{unlocked} / {total}</h2>
        <p style={{ margin: '5px 0 0', opacity: 0.8 }}>已解锁成就</p>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: achievement.unlocked 
                  ? 'rgba(102, 126, 234, 0.2)' 
                  : 'rgba(255,255,255,0.05)',
                border: achievement.unlocked 
                  ? '1px solid rgba(102, 126, 234, 0.5)' 
                  : '1px solid rgba(255,255,255,0.1)',
                opacity: achievement.unlocked ? 1 : 0.5,
                transition: 'all 0.3s'
              }}
            >
              <span style={{ fontSize: '24px' }}>
                {achievement.unlocked ? '✅' : '🔒'}
              </span>
              <p style={{ margin: '8px 0 0', fontWeight: 'bold' }}>
                {achievement.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
