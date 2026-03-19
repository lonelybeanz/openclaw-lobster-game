import type { AchievementTimelineUnlock } from '../types';

interface AchievementTimelineProps {
  unlocks: AchievementTimelineUnlock[];
}

const CATEGORY_BORDER: Record<string, string> = {
  interaction: '#60a5fa',
  growth: '#34d399',
  social: '#f59e0b',
  bond: '#f472b6',
  memory: '#a78bfa',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AchievementTimeline({ unlocks }: AchievementTimelineProps) {
  return (
    <section className="timeline-card">
      <div className="timeline-card-head">
        <div>
          <p className="timeline-kicker">成就解锁</p>
          <h2>成长里程碑时间轴</h2>
        </div>
      </div>

      <div className="achievement-timeline">
        {unlocks.map((item) => (
          <article key={`${item.achievement.id}-${item.date}`} className="achievement-item">
            <div className="achievement-date">{formatDate(item.date)}</div>
            <div className="achievement-dot" />
            <div
              className="achievement-card"
              style={{
                borderColor: CATEGORY_BORDER[item.achievement.category] ?? '#94a3b8',
              }}
            >
              <span className="achievement-icon">{item.achievement.icon}</span>
              <div>
                <h3>{item.achievement.name}</h3>
                <p>{item.achievement.category}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
