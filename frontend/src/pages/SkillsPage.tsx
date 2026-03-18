import { useEffect, useState } from 'react';
import { getSkills } from '../api';
import type { SkillStats } from '../types';

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkills()
      .then(setSkills)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-shell"><p>技能分析加载中...</p></div>;
  if (error) return <div className="page-shell"><p>加载失败: {error}</p></div>;
  if (!skills) return <div className="page-shell"><p>暂无技能数据</p></div>;

  return (
    <div className="page-shell" style={{ padding: '20px' }}>
      <h1>🧠 技能分析</h1>
      
      <div className="kpi-grid" style={{ marginTop: '20px' }}>
        <article className="kpi-card gradient-card-soft">
          <p>总技能数</p>
          <h2>{skills.total}</h2>
        </article>
        <article className="kpi-card gradient-card-soft">
          <p>技能分类</p>
          <h2>{skills.categories?.length || 0}</h2>
        </article>
      </div>

      {skills.categories && skills.categories.length > 0 && (
        <>
          <h2 style={{ marginTop: '30px' }}>技能分类</h2>
          <div className="kpi-grid" style={{ marginTop: '10px' }}>
            {skills.categories.map((cat: string) => (
              <article key={cat} className="kpi-card gradient-card-soft">
                <p>{cat}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {skills.recentlyAdded && skills.recentlyAdded.length > 0 && (
        <>
          <h2 style={{ marginTop: '30px' }}>最近添加</h2>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            {skills.recentlyAdded.map((skill: string) => (
              <li key={skill} style={{ marginBottom: '8px' }}>✨ {skill}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
