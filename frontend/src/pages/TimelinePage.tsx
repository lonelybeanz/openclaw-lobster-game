import { useEffect, useMemo, useState } from 'react';
import AchievementTimeline from '../components/AchievementTimeline';
import GrowthHeatmap from '../components/GrowthHeatmap';
import HealthChart from '../components/HealthChart';
import { getHealthTimeline, getTimelineAchievements, getTimelineHeatmap } from '../api';
import type { AchievementTimelineUnlock, GrowthHeatmapItem, HealthPeriod, HealthRecord } from '../types';

export default function TimelinePage() {
  const year = new Date().getFullYear();
  const [period, setPeriod] = useState<HealthPeriod>('30d');
  const [heatmap, setHeatmap] = useState<GrowthHeatmapItem[]>([]);
  const [health, setHealth] = useState<HealthRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementTimelineUnlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getTimelineHeatmap(year), getTimelineAchievements()])
      .then(([heatmapData, achievementData]) => {
        if (cancelled) {
          return;
        }
        setHeatmap(Array.isArray(heatmapData) ? heatmapData : []);
        setAchievements(Array.isArray(achievementData) ? achievementData : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载时间线失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);

    getHealthTimeline(period)
      .then((data) => {
        if (!cancelled) {
          setHealth(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载健康趋势失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHealthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const highlights = useMemo(() => {
    const hottestDay = heatmap.reduce<GrowthHeatmapItem | null>((best, item) => {
      if (!best || item.interactions > best.interactions) {
        return item;
      }
      return best;
    }, null);
    const latestAchievement = achievements[0] ?? null;
    const criticalHealth = [...health].reverse().find((item) => item.health <= 40 || item.fatigue >= 80) ?? null;

    return [
      {
        label: '最活跃日',
        value: hottestDay ? `${hottestDay.date} · ${hottestDay.interactions} 次` : '--',
      },
      {
        label: '最近成就',
        value: latestAchievement ? `${latestAchievement.achievement.icon} ${latestAchievement.achievement.name}` : '--',
      },
      {
        label: '健康预警',
        value: criticalHealth
          ? `${new Date(criticalHealth.timestamp).toLocaleDateString('zh-CN')} · 健康 ${criticalHealth.health}`
          : '近期稳定',
      },
    ];
  }, [achievements, health, heatmap]);

  return (
    <div className="page-shell timeline-page">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />
      <div className="bg-orb bg-orb-three" />

      <header className="timeline-hero glass-card">
        <div>
          <p className="eyebrow">Growth Storyboard</p>
          <h1>📈 成长时间线</h1>
          <p className="timeline-hero-copy">把互动密度、状态波动和成就解锁串成一条完整的成长轨迹。</p>
        </div>
        <div className="timeline-period-switch">
          {(['7d', '30d', '90d'] as HealthPeriod[]).map((item) => (
            <button
              key={item}
              type="button"
              className={item === period ? 'timeline-period-btn active' : 'timeline-period-btn'}
              onClick={() => setPeriod(item)}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <section className="timeline-highlight-grid">
        {highlights.map((item) => (
          <article key={item.label} className="timeline-highlight-card glass-card">
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      {error ? <div className="panel error glass-card">时间线加载失败：{error}</div> : null}
      {loading ? <div className="panel glass-card">正在整理成长记录...</div> : null}

      {!loading ? (
        <div className="timeline-layout">
          <GrowthHeatmap data={heatmap} year={year} />
          <div className="timeline-side-column">
            {healthLoading ? <div className="timeline-card">健康趋势加载中...</div> : <HealthChart period={period} data={health} />}
            <AchievementTimeline unlocks={achievements} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
