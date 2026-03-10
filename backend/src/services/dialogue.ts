export interface Dialogue {
  id: string;
  text: string;
  mood: 'happy' | 'sad' | 'excited' | 'tired' | 'hungry' | 'bored';
  action?: string;
}

// 基于状态的对话
export function generateDialogue(stats: any): Dialogue {
  const { hunger, mood, fatigue, level, brain, limbs } = stats;
  
  // 饥饿时
  if (hunger < 30) {
    return {
      id: 'hungry_' + Date.now(),
      text: '我饿得前胸贴后背了...给我点吃的嘛~ 🦞',
      mood: 'hungry',
      action: '快去厨房喂食！'
    };
  }
  
  // 疲劳时
  if (fatigue > 80) {
    return {
      id: 'tired_' + Date.now(),
      text: '好累啊，让我休息一下吧... 😴',
      mood: 'tired',
      action: '点击休息恢复体力'
    };
  }
  
  // 心情好时
  if (mood > 70) {
    const happyDialogues = [
      '今天心情真好！陪你聊天很开心~ 🎉',
      '我又学到了新东西，脑袋越来越灵光啦！',
      '感觉我的神经元又增加了呢！',
      '和你在一起的每一天都在成长！'
    ];
    return {
      id: 'happy_' + Date.now(),
      text: happyDialogues[Math.floor(Math.random() * happyDialogues.length)],
      mood: 'happy'
    };
  }
  
  // 无聊时
  if (level < 3) {
    return {
      id: 'bored_' + Date.now(),
      text: '好无聊啊...有什么可以让我学习的吗？ 📖',
      mood: 'bored',
      action: '带我去书房学习新技能！'
    };
  }
  
  // 升级庆祝
  if (level >= 5 && level <= 7) {
    return {
      id: 'excited_' + Date.now(),
      text: `等级达到 ${level} 了！我又变强了！💪`,
      mood: 'excited'
    };
  }
  
  // 正常状态
  const normalDialogues = [
    '今天也在努力学习呢~ 📚',
    '神经元数量：${brain?.neurons || 0}，状态良好！',
    '尾巴又有力量了！要训练吗？',
    '触角感知到你在身边... 🦐'
  ];
  
  return {
    id: 'normal_' + Date.now(),
    text: normalDialogues[Math.floor(Math.random() * normalDialogues.length)],
    mood: 'happy'
  };
}

// 随机事件
export function getRandomEvent(): { title: string; description: string; effect: string } | null {
  const events = [
    {
      title: '🎯 灵感爆发',
      description: '突然想到一个绝妙的主意！',
      effect: '+5 经验'
    },
    {
      title: '📝 记忆碎片',
      description: '回想起之前的某个任务...',
      effect: '+3 长期记忆'
    },
    {
      title: '🧘 冥想时刻',
      description: '安静地思考人生中...',
      effect: '-5 疲劳'
    },
    {
      title: '🍕 美味大餐',
      description: '吃了顿好的！',
      effect: '+20 饱食度'
    }
  ];
  
  // 30% 概率触发事件
  if (Math.random() < 0.3) {
    return events[Math.floor(Math.random() * events.length)];
  }
  return null;
}
