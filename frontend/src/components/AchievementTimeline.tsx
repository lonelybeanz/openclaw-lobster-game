import { useEffect, useState } from 'react';
import { getAchievementUnlockHistory } from '../api';
import type { AchievementUnlockHistoryItem } from '../types';

type AchievementUnlockHistoryApiItem = Partial<AchievementUnlockHistoryItem> & {
  achievementId?: string;
  title?: string;
  unlocked_at?: string;
  unlockTime?: string;
  achievedAt?: string;
  date?: string;
  achievement?: {
    id?: string;
    name?: string;
    title?: string;
    icon?: string;
  };
};

function normalizeHistoryItem(item: AchievementUnlockHistoryApiItem, index: number): AchievementUnlockHistoryItem {
  const nested = item.achievement;
  return {
    id: item.id || item.achievementId || nested?.id || `achievement-history-${index}`,
    name: item.name || item.title || nested?.name || nested?.title || '未命名成就',
    icon: item.icon || nested?.icon || '🏆',
    unlockedAt: item.unlockedAt || item.unlocked_at || item.unlockTime || item.achievedAt || item.date || '',
  };
}

function formatUnlockTime(value: string) {
  if (!value) {
    return '时间未知';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AchievementTimeline() {
  const [items, setItems] = useState<AchievementUnlockHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAchievementUnlockHistory();
        if (cancelled) {
          return;
        }

        const normalized = (Array.isArray(data) ? data : [])
          .map((item, index) => normalizeHistoryItem(item as AchievementUnlockHistoryApiItem, index))
          .sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));
        setItems(normalized);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="panel glass-card"
      style={{
        marginTop: '18px',
        padding: '18px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, rgba(11, 18, 32, 0.92), rgba(17, 24, 39, 0.78))',
      }}
    >
      <div style={{ marginBottom: '14px' }}>
        <h4 style={{ margin: 0 }}>🏆 成就解锁历史</h4>
        <p style={{ margin: '6px 0 0', color: 'rgba(226,232,240,0.78)', fontSize: '13px', lineHeight: 1.6 }}>
          展示最近解锁的成就时间线。
        </p>
      </div>

      {loading ? <p style={{ margin: 0 }}>解锁历史加载中...</p> : null}
      {error ? <p style={{ margin: 0, color: '#ffb4b4' }}>加载失败：{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p style={{ margin: 0 }}>暂无成就解锁记录</p> : null}

      {!loading && !error && items.length > 0 ? (
        <div style={{ position: 'relative', paddingLeft: '18px' }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '10px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              background: 'linear-gradient(180deg, rgba(125,211,252,0.75), rgba(244,114,182,0.25))',
            }}
          />
          <div style={{ display: 'grid', gap: '12px' }}>
            {items.map((item) => (
              <article
                key={`${item.id}-${item.unlockedAt}`}
                style={{
                  position: 'relative',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-13px',
                    top: '20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '999px',
                    background: '#7dd3fc',
                    boxShadow: '0 0 0 4px rgba(125,211,252,0.16)',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>{item.icon}</span>
                    <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                  </div>
                  <time style={{ fontSize: '12px', color: 'rgba(191,219,254,0.88)' }}>{formatUnlockTime(item.unlockedAt)}</time>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
