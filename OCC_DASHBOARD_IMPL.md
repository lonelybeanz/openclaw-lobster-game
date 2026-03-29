# OCC 游戏化仪表盘 - 实施文档

> 将 OpenClaw Control Center (OCC) 的卡片模型转换为龙虾养成游戏仪表盘

---

## 📋 项目概述

本项目将 OCC 的运营洞察卡片模型映射为游戏化 UI，让运营者和玩家在同一个界面查看 "龙虾的健康、成长与资源"。

---

## 🗂️ 文件结构

```
openclaw-lobster-game/
├── backend/
│   ├── src/
│   │   ├── types/
│   │   │   └── dashboard.ts          # 后端类型定义
│   │   ├── services/
│   │   │   └── gameDashboard.ts      # 游戏化数据服务
│   │   └── app.ts                    # API 路由更新
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── types/
│   │   │   └── dashboard.ts          # 前端类型定义
│   │   ├── components/
│   │   │   ├── GameDashboard.tsx     # 主仪表盘组件
│   │   │   ├── GameDashboard.css     # 游戏化样式
│   │   │   └── dashboard/
│   │   │       ├── HealthPanel.tsx   # 健康中心
│   │   │       ├── EnergyPanel.tsx   # 能量核心
│   │   │       ├── StaffPanel.tsx    # 养殖师团队
│   │   │       ├── EvolutionPanel.tsx # 进化树
│   │   │       ├── MemoryPalacePanel.tsx # 记忆宫殿
│   │   │       ├── HandbookPanel.tsx # 养殖手册
│   │   │       ├── TaskBoardPanel.tsx # 任务板
│   │   │       └── FacilityPanel.tsx # 设施状态
│   │   ├── api.ts                    # API 客户端更新
│   │   └── pages/
│   │       └── LobsterPage.tsx       # 集成 Dashboard Tab
│   └── ...
└── OCC_DASHBOARD_IMPL.md             # 本文件
```

---

## 🎮 OCC 卡片映射详情

| OCC 卡片 | 游戏化名称 | 核心指标 | 数据来源 |
|---------|-----------|---------|---------|
| **Overview** | 🏥 健康中心 | HP(体力), Stamina(新陈代谢) | 系统 CPU/Memory |
| **Usage** | ⚡ 能量核心 | 能量消耗, 成长进度 | Token 统计 |
| **Staff** | 👥 养殖师团队 | 活跃 Agents, 团队心情 | Session 文件 |
| **Collaboration** | 🧬 进化之路 | 进化节点, 成长阶段 | 里程碑数据 |
| **Memory** | 🧠 记忆宫殿 | 记忆碎片, 收集进度 | Memory 评分 |
| **Documents** | 📚 养殖手册 | 文档阅读进度 | Handbook 配置 |
| **Tasks** | 🎯 任务板 | 日常/周常任务 | 任务配置 |
| **Settings** | 🔧 设施状态 | 水质, 季节, 温度 | 系统状态 |

---

## 🔌 API 端点

### 统一仪表盘
```
GET /lobster/dashboard
```

### 各模块独立端点
```
GET /lobster/dashboard/health     # 健康中心
GET /lobster/dashboard/energy     # 能量核心
GET /lobster/dashboard/staff      # 养殖师团队
GET /lobster/dashboard/evolution  # 进化树
GET /lobster/dashboard/memory     # 记忆宫殿
GET /lobster/dashboard/handbook   # 养殖手册
GET /lobster/dashboard/tasks      # 任务板
GET /lobster/dashboard/facility   # 设施状态
```

---

## 🎨 视觉设计系统

### 颜色主题
- **主背景**: `#0a0f1a` → 深色太空感
- **卡片背景**: `rgba(17, 24, 39, 0.8)` → 半透明玻璃
- **强调色**:
  - 🔵 Blue: `#3b82f6` - 信息/健康
  - 🟣 Purple: `#8b5cf6` - 记忆/能量
  - 🟢 Green: `#22c55e` - 成功/团队
  - 🟠 Orange: `#f59e0b` - 警告/能量
  - 🩷 Pink: `#ec4899` - 团队/活跃
  - 🔵 Cyan: `#06b6d4` - 设施/水质

### 交互动效
- 卡片悬浮: `translateY(-4px)` + 阴影增强
- 进度条: 渐变色彩 + 平滑过渡
- 水波纹: CSS 动画模拟水质状态
- 呼吸灯: 健康状态指示器

---

## 🚀 使用说明

### 1. 启动后端
```bash
cd backend
bun run dev
```

### 2. 启动前端
```bash
cd frontend
npm run dev
```

### 3. 访问仪表盘
打开 http://localhost:15173

默认进入 **🎮仪表盘** Tab，可以看到：
- 顶部总体统计（等级、游戏时长、总进度）
- 8 个游戏化卡片（健康、能量、团队、进化、记忆、手册、任务、设施）
- 点击卡片可展开详细信息

---

## 🧩 扩展开发

### 添加新的 OCC 卡片映射

1. **类型定义** (`types/dashboard.ts`)
```typescript
export interface NewModuleMetrics {
  // 定义指标
}
```

2. **数据服务** (`services/gameDashboard.ts`)
```typescript
export async function getNewModuleMetrics(): Promise<NewModuleMetrics> {
  // 数据聚合逻辑
}
```

3. **API 路由** (`app.ts`)
```typescript
app.get('/lobster/dashboard/new-module', async (c) => {
  const data = await getNewModuleMetrics();
  return c.json({ code: 0, data });
});
```

4. **前端组件** (`components/dashboard/`)
```typescript
export function NewModulePanel({ data }: { data: NewModuleMetrics }) {
  // UI 实现
}
```

---

## 📊 数据流

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OpenClaw      │────▶│  gameDashboard  │────▶│   /dashboard    │
│   数据源        │     │   服务聚合       │     │   API 端点      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                              ┌─────────────────┐      │
                              │  GameDashboard  │◀─────┘
                              │   组件渲染       │
                              │                 │
                              │  ┌───────────┐  │
                              │  │HealthPanel│  │
                              │  │EnergyPanel│  │
                              │  │ StaffPanel│  │
                              │  │    ...    │  │
                              │  └───────────┘  │
                              └─────────────────┘
```

---

## 🔮 未来扩展

- [ ] **实时数据推送**: WebSocket 连接 OCC 实时状态
- [ ] **3D 可视化**: Three.js 渲染龙虾模型
- [ ] **声音效果**: 互动音效增强游戏感
- [ ] **移动端优化**: 响应式布局适配手机
- [ ] **暗黑/明亮主题**: 主题切换功能
- [ ] **成就动画**: 解锁时的粒子效果

---

## 📝 更新日志

### v1.0.0 (2026-03-25)
- ✨ 初始版本发布
- 🎮 8 个 OCC 卡片游戏化映射
- 📊 统一仪表盘数据聚合
- 🎨 深色游戏化主题
- 🔌 完整 API 端点支持
