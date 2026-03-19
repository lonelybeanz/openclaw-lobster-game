import type { LlmMilestoneCard, LlmMilestonesResponse } from '../types';

type Props = {
  data: LlmMilestonesResponse | null;
  loading: boolean;
  error: string | null;
};

const levelTone: Record<LlmMilestoneCard['level'], { border: string; glow: string; badge: string }> = {
  bronze: { border: 'rgba(251, 191, 36, 0.25)', glow: 'rgba(251, 191, 36, 0.08)', badge: '#fbbf24' },
  silver: { border: 'rgba(148, 163, 184, 0.35)', glow: 'rgba(148, 163, 184, 0.12)', badge: '#cbd5e1' },
  gold: { border: 'rgba(250, 204, 21, 0.45)', glow: 'rgba(250, 204, 21, 0.14)', badge: '#fde047' },
  mythic: { border: 'rgba(244, 114, 182, 0.45)', glow: 'rgba(168, 85, 247, 0.16)', badge: '#f9a8d4' },
};

function formatDateTime(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LlmMilestoneCards({ data, loading, error }: Props) {
  if (loading) {
    return <p style={{ margin: '12px 0 0' }}>LLM 成就卡生成中...</p>;
  }

  if (error) {
    return <p style={{ margin: '12px 0 0', color: '#ffb4b4' }}>动态成就加载失败：{error}</p>;
  }

  if (!data || data.cards.length === 0) {
    return <p style={{ margin: '12px 0 0' }}>暂无动态成就卡</p>;
  }

  return (
    <section style={{ marginTop: '18px' }}>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(99, 102, 241, 0.14))',
          border: '1px solid rgba(125, 211, 252, 0.24)',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
          <strong>LLM 动态成就卡</strong>
          <span style={{ fontSize: '12px', opacity: 0.72 }}>
            {data.source === 'cache' ? '24h 缓存' : data.source === 'stale-cache' ? '过期缓存' : data.source === 'fallback' ? '规则兜底' : '实时生成'}
          </span>
        </div>
        <p style={{ margin: '0 0 6px 0', opacity: 0.92 }}>{data.summary}</p>
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.68 }}>生成时间：{formatDateTime(data.generatedAt)}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {data.cards.map((card) => {
          const tone = levelTone[card.level];
          const width = Math.max(8, Math.min(100, (card.progress / Math.max(card.maxProgress, 1)) * 100));

          return (
            <article
              key={card.id}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: `linear-gradient(155deg, ${tone.glow}, rgba(255,255,255,0.04))`,
                border: `1px solid ${tone.border}`,
                boxShadow: `0 12px 30px ${tone.glow}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '24px' }}>{card.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', opacity: 0.72 }}>{card.category}</div>
                    <strong>{card.name}</strong>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#09111f',
                    background: tone.badge,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {card.level}
                </span>
              </div>

              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{card.headline}</p>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.9, lineHeight: 1.6 }}>{card.description}</p>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', opacity: 0.75, marginBottom: '6px' }}>
                  <span>{card.metricLabel}</span>
                  <span>{card.metricValue}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${width}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: `linear-gradient(90deg, ${tone.badge}, rgba(255,255,255,0.9))`,
                    }}
                  />
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.7 }}>
                  进度 {card.progressText} · 分数 {card.score}
                </div>
              </div>

              <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#dbeafe' }}>
                {card.unlocked ? '已激活' : '待激活'} · {card.nextHint}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
