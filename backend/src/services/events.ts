// 随机事件系统
export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  effect: {
    mood?: number;
    hunger?: number;
    fatigue?: number;
    experience?: number;
    loyalty?: number;
  };
  probability: number; // 权重
}

const events: RandomEvent[] = [
  {
    id: 'inspiration',
    title: '💡 灵感爆发',
    description: '突然想到一个绝妙的点子！',
    effect: { mood: 10, experience: 20 },
    probability: 10
  },
  {
    id: 'deep_think',
    title: '🤔 深度思考',
    description: '进入心流状态，效率翻倍',
    effect: { experience: 30, fatigue: 5 },
    probability: 8
  },
  {
    id: 'curiosity',
    title: '🧐 好奇宝宝',
    description: '发现了一些有趣的东西',
    effect: { mood: 5, experience: 10 },
    probability: 15
  },
  {
    id: 'lazy_day',
    title: '😴 偷懒时刻',
    description: '今天什么都不想做...',
    effect: { fatigue: -10, mood: -5 },
    probability: 10
  },
  {
    id: 'memory_fragment',
    title: '🔮 记忆碎片',
    description: '突然回忆起一些重要的事情',
    effect: { experience: 15, mood: 5 },
    probability: 12
  },
  {
    id: 'energy_drink',
    title: '⚡ 能量饮料',
    description: '喝了一杯咖啡，状态满满',
    effect: { fatigue: -15, mood: 5 },
    probability: 8
  },
  {
    id: 'learn_new',
    title: '📚 学到新东西',
    description: '解锁了新技能！',
    effect: { experience: 25, mood: 10 },
    probability: 7
  },
  {
    id: 'user_praise',
    title: '👏 用户夸奖',
    description: '受到表扬，开心！',
    effect: { mood: 15, loyalty: 5 },
    probability: 5
  }
];

// 触发随机事件
export function triggerRandomEvent(): RandomEvent | null {
  if (events.length === 0) return null;

  const totalWeight = events.reduce((sum, event) => sum + Math.max(0, event.probability), 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const event of events) {
    roll -= Math.max(0, event.probability);
    if (roll <= 0) {
      return event;
    }
  }

  return events[events.length - 1] ?? null;
}

// 获取所有事件
export function getAllEvents(): RandomEvent[] {
  return events;
}
