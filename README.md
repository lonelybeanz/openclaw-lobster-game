# 🦞 OpenClaw Lobster Game

> A gamified AI assistant management system - raise your own lobster companion!

![Version](https://img.shields.io/badge/version-2.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20|%20Linux-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🎯 项目简介

龙虾游戏是一个基于 OpenClaw 的游戏化 AI 助手管理系统。用户可以通过喂食、训练、休息等交互方式，与 AI 助手建立情感连接，同时追踪其成长轨迹、成就解锁和数据统计。

## ✨ 核心功能

### 📊 数据可视化
| 模块 | 功能 | API |
|------|------|------|
| **Token 统计** | 会话 token 追踪、日/周趋势、TOP Sessions | `/lobster/tokens` |
| **记忆评分** | AI 记忆质量评分、索引健康度 | `/lobster/memory-score` |
| **技能分析** | 技能分布统计、使用排行 | `/lobster/skills` |
| **成长热力图** | 全年互动密度可视化 | `/lobster/timeline/heatmap` |

### 🎮 交互系统
- **喂食** 🍖 - 恢复龙虾饥饿值
- **训练** 💪 - 提升龙虾经验值
- **休息** 😴 - 降低疲劳度
- **深度对话** 💬 - 与龙虾进行 AI 对话

### 🏆 成就系统
- **5 大类别**: 进化、智脑、技能、探索、心路历程
- **27+ 成就**: 19 个基础成就 + 8 个 LLM 动态生成
- **永久存储**: JSON 持久化，支持动态添加

### 📈 成长时间线
- 健康趋势图（7d/30d/90d）
- 成就解锁时间轴
- 成长数据快照

## 🏗️ 系统架构

```
openclaw-lobster-game/
├── backend/                    # Hono 后端服务
│   ├── src/
│   │   ├── app.ts            # API 路由入口
│   │   ├── index.ts          # 服务启动配置
│   │   ├── services/         # 核心服务
│   │   │   ├── persistence.ts       # 状态持久化
│   │   │   ├── tokenStats.ts        # Token 统计
│   │   │   ├── memoryScore.ts       # 记忆评分
│   │   │   ├── visualization.ts     # 可视化数据
│   │   │   ├── snapshotStore.ts     # 快照存储
│   │   │   ├── healthTimeline.ts    # 健康时间线
│   │   │   ├── achievementStore.ts  # 成就存储
│   │   │   └── reportGenerator.ts   # 报告生成
│   │   └── cron/             # 定时任务
│   │       └── llmMilestoneCron.ts  # LLM 成就生成
│   ├── data/                 # 数据文件
│   │   ├── achievements.json      # 成就配置
│   │   └── llm-milestones.json   # LLM 成就缓存
│   └── runtime/              # 运行时数据
│       ├── timeline.log          # 健康日志
│       └── reports/             # 生成报告
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   └── LobsterPage.tsx    # 主页面（含 Tab 导航）
│   │   ├── components/
│   │   │   ├── VisualizationDashboard.tsx  # 数据面板
│   │   │   ├── MemoryScorePanel.tsx        # 记忆评分
│   │   │   ├── GrowthHeatmap.tsx           # 成长热力图
│   │   │   ├── HealthChart.tsx             # 健康趋势
│   │   │   └── AchievementTimeline.tsx    # 成就时间轴
│   │   └── api.ts              # API 调用封装
│   └── vite.config.ts
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Bun (后端运行时)
- OpenClaw 已配置

### 安装启动

```bash
# 1. 克隆项目
git clone https://github.com/lonelybeanz/openclaw-lobster-game.git
cd openclaw-lobster-game

# 2. 启动后端 (端口 13000)
cd backend
bun install
bun run dev

# 3. 启动前端 (端口 15173)
cd ../frontend
npm install
npm run dev
```

### 访问地址
- **前端**: http://localhost:15173
- **后端 API**: http://localhost:13000

## 📡 API 文档

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/lobster/stats` | 获取龙虾状态 |
| POST | `/lobster/interact` | 交互操作 |
| GET | `/lobster/milestones` | 获取成就列表 |
| GET | `/lobster/visualization` | 可视化数据快照 |
| GET | `/lobster/timeline/heatmap` | 成长热力图 |
| GET | `/lobster/health/trend` | 健康趋势 |
| GET | `/lobster/reports/latest` | 最新报告 |

### 交互操作

```bash
# 喂食
curl -X POST http://localhost:13000/lobster/interact \
  -H "Content-Type: application/json" \
  -d '{"action":"feed"}'

# 训练
curl -X POST http://localhost:13000/lobster/interact \
  -H "Content-Type: application/json" \
  -d '{"action":"train"}'

# 休息
curl -X POST http://localhost:13000/lobster/interact \
  -H "Content-Type: application/json" \
  -d '{"action":"rest"}'
```

## 📊 数据源

| 数据类型 | 来源 | 说明 |
|----------|------|------|
| Token 使用 | `~/.openclaw/agents/*/sessions/sessions.json` | 会话统计 |
| 记忆评分 | `~/.openclaw/memory/` | 索引健康度 |
| 技能列表 | `~/.openclaw/skills/` | 技能统计 |
| 成就配置 | `backend/data/achievements.json` | 本地 JSON |

## 🛠️ 扩展开发

### 添加新成就

编辑 `backend/data/achievements.json`:

```json
{
  "id": "my_achievement",
  "name": "我的成就",
  "description": "达成某个里程碑",
  "icon": "🏅",
  "category": "journey",
  "condition": {
    "type": "stat_gte",
    "stat": "level",
    "value": 5
  },
  "order": 100
}
```

### 自定义 LLM 成就生成

定时任务位于 `backend/src/cron/llmMilestoneCron.ts`，每 6 小时自动生成新成就。

## 🔧 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 13000 | 后端端口 |
| `OPENCLAW_DIR` | `~/.openclaw` | OpenClaw 数据目录 |

### 缓存配置

- Token 统计: 20s 缓存
- Skills: 20s 缓存
- Milestones: 30s 缓存
- LLM 成就: 6 小时刷新

## 📈 路线图

- [ ] Discord/Telegram 机器人集成
- [ ] 成就徽章系统
- [ ] 社交分享功能
- [ ] 多龙虾支持
- [ ] 云端同步

## 📝 更新日志

### v2.0 (2026-03-19)
- ✨ 6 大功能优化合并
- 🆕 快照存储系统
- 🆕 健康度时间线
- 🆕 成就持久化
- 🆕 成长时间线页面
- 🆕 报告生成器
- 🆕 LLM 定时任务
- 🐛 Token 统计修复

### v1.0 (2026-03-15)
- 基础交互系统
- 成就系统
- 数据可视化

## 📄 License

MIT License - 详情见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) - AI Agent 框架
- [Hono](https://hono.dev/) - 轻量级后端框架
- [Vite](https://vitejs.dev/) - 前端构建工具
