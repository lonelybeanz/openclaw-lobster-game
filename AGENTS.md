# OpenClaw Lobster Game - Agent Guide

> A gamified AI assistant management system - raise your own lobster companion!

## Project Overview

龙虾游戏 (Lobster Game) is a gamified AI assistant management system built on top of [OpenClaw](https://github.com/openclaw/openclaw). Users interact with their AI assistant through a virtual lobster companion, tracking growth, achievements, memory health, and usage statistics.

### Core Concept
- The "lobster" represents the user's AI assistant
- Interactions (feeding, training, resting) affect the lobster's state
- System analyzes real OpenClaw usage data (tokens, sessions, memory files)
- Gamified progression with levels, achievements, and milestones

## Technology Stack

### Backend
- **Runtime**: Bun (Node.js alternative)
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript 5.9+
- **Cron Jobs**: node-cron for scheduled tasks

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 6
- **Language**: TypeScript 5.7+
- **Charts**: ECharts 5 + echarts-for-react
- **HTTP Client**: Axios

### Data Storage
- **State**: JSON files in `~/.openclaw/workspace/projects/openclaw-lobster-game/data/`
- **Achievements**: `backend/data/achievements.json`
- **Token Stats**: Cached from OpenClaw agent sessions
- **Memory Analysis**: Real-time analysis of `~/.openclaw/memory/` and `~/.openclaw/agents/`

## Project Structure

```
openclaw-lobster-game/
├── backend/                    # Hono backend service
│   ├── index.ts               # Entry point (Bun serve config)
│   ├── src/
│   │   ├── app.ts             # Main Hono app with routes
│   │   ├── types.ts           # Shared TypeScript types
│   │   ├── services/          # Core business logic
│   │   │   ├── persistence.ts       # Lobster state persistence
│   │   │   ├── lobster.ts           # Core lobster stats calculation
│   │   │   ├── lobsterStateEngine.ts # Dynamic state computation
│   │   │   ├── tokenStats.ts        # Token usage analysis
│   │   │   ├── memoryScore.ts       # Memory health scoring
│   │   │   ├── memoryAnalyzer.ts    # Memory file analysis
│   │   │   ├── memoryLlmEval.ts     # LLM-based memory evaluation
│   │   │   ├── skillsAnalyzer.ts    # Skills directory analysis
│   │   │   ├── milestones.ts        # Achievement/milestone logic
│   │   │   ├── llmMilestones.ts     # LLM-generated dynamic milestones
│   │   │   ├── visualization.ts     # Data aggregation for charts
│   │   │   ├── healthTimeline.ts    # Health trend tracking
│   │   │   ├── achievementStore.ts  # Achievement persistence
│   │   │   ├── modelMapper.ts       # AI model → lobster brain mapping
│   │   │   ├── modelBenchmark.ts    # Model benchmark data
│   │   │   ├── events.ts            # Random event system
│   │   │   └── cache.ts             # TTL caching utility
│   │   ├── cron/
│   │   │   └── llmMilestoneCron.ts  # Scheduled LLM milestone generation
│   │   └── scripts/
│   │       └── memory-score-cron.ts # Memory evaluation cron script
│   └── data/
│       ├── achievements.json        # Achievement definitions
│       ├── llm-milestones.json      # Cached LLM-generated milestones
│       ├── token-stats.json         # Token usage cache
│       └── model-benchmarks.json    # Model performance data
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx            # Root component
│   │   ├── main.tsx           # Entry point
│   │   ├── api.ts             # API client with timeout support
│   │   ├── types.ts           # Frontend TypeScript types
│   │   ├── pages/
│   │   │   └── LobsterPage.tsx      # Main page with tabs
│   │   └── components/
│   │       ├── VisualizationDashboard.tsx  # Charts dashboard
│   │       ├── MemoryScorePanel.tsx        # Memory health UI
│   │       ├── AchievementTimeline.tsx     # Achievement history
│   │       ├── EvolutionTrendChart.tsx     # Evolution score trends
│   │       └── HealthTimelinePanel.tsx     # Health metrics
│   ├── vite.config.ts         # Vite config with proxy
│   └── index.html
├── data/                       # Runtime data (gitignored)
│   ├── lobster-state.json
│   ├── memory-score-history.json
│   └── memory-llm-eval-results.json
├── start.sh                   # Unified start script
└── runtime/                   # Runtime logs
    └── timeline.log
```

## Build and Run Commands

### Development (using start.sh - Recommended)

```bash
# Start both backend and frontend in background
./start.sh

# Or specific services
./start.sh backend    # Frontend only
./start.sh frontend   # Backend only
./start.sh restart    # Restart all
./start.sh stop       # Stop all
```

### Backend (standalone)

```bash
cd backend
bun install

# Development with hot reload
bun run dev           # Port 13000

# Production
bun run build         # Build to dist/
bun run start         # Run built version

# Type checking
bun run typecheck

# Memory score cron (manual run)
bun run memory:cron
```

### Frontend (standalone)

```bash
cd frontend
npm install

# Development
npm run dev           # Port 15173

# Production build
npm run build

# Preview production build
npm run preview
```

## API Endpoints

All endpoints return `{ code: number, data: T, message?: string }` format.

### Core Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lobster/stats` | Full lobster stats with computed state |
| GET | `/lobster/skills` | Skills analysis |
| GET | `/lobster/tokens` | Token usage statistics |
| POST | `/lobster/interact` | Feed/train/rest actions |
| GET | `/lobster/achievements` | Achievement list |
| GET | `/lobster/milestones` | Milestones with LLM cards |
| GET | `/lobster/memory-score` | Memory health snapshot |
| GET | `/lobster/memory-llm-eval` | LLM memory evaluation |
| POST | `/lobster/memory-llm-eval/save` | Save evaluation result |
| GET | `/lobster/visualization` | Charts data snapshot |
| GET | `/lobster/health/trend` | Health trends (7d/30d/90d) |
| GET | `/lobster/timeline/heatmap` | Activity heatmap |
| GET | `/lobster/news` | OpenClaw-related news |
| POST | `/lobster/search-news` | Async news search |
| POST | `/lobster/deeptalk` | Chat with lobster via OpenClaw |

### Caching

- Stats: 20s TTL
- Skills: 20s TTL
- Milestones: 30s TTL
- News: 60s TTL
- General: 5min TTL

## Code Style Guidelines

### TypeScript
- **Strict mode**: Enabled in backend, disabled in frontend
- **Type imports**: Use `import type { X } from './module'`
- **Export style**: Named exports preferred
- **File naming**: camelCase for services, PascalCase for components

### Backend Conventions
```typescript
// Services should export typed functions
export async function getLobsterStats(): Promise<LobsterStats> { }

// Use async/await, avoid callbacks
// Error handling: try/catch with console.error logs
// Cache utilities in cache.ts for TTL caching
```

### Frontend Conventions
```typescript
// Components use functional style with hooks
export default function ComponentName() { }

// API calls go through api.ts client
// Types shared between frontend/backend defined in both types.ts files
```

### Naming Conventions
- **Files**: camelCase for logic, PascalCase for React components
- **Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE for true constants

## Testing Strategy

Currently minimal test coverage:
- `backend/src/services/evolutionScore.test.ts` - Example test file

### Manual Testing Checklist

1. **Backend startup**: `bun run dev` should start on port 13000
2. **Frontend startup**: `npm run dev` should start on port 15173
3. **API check**: `curl http://localhost:13000/lobster/stats`
4. **Page tabs**: Verify Status / Evolution / Memory / News tabs
5. **Interactions**: Test feed/train/rest buttons
6. **Memory panel**: Check AI evaluation flow

## Key Implementation Details

### Lobster State Engine (`lobsterStateEngine.ts`)

Core algorithms:
- **Experience**: `tokens / 1000`
- **Level**: `floor(log2(experience / 1000)) + 1`
- **Hunger**: `max(20, 100 - idleHours * 5)`
- **Mood**: `min(100, 80 + recentSessions / 10)`
- **Fatigue**: `min(80, recentSessions / 5)`
- **Loyalty**: `min(100, 50 + days)`

### Brain/Limbs Calculation (`lobster.ts`)

Attributes calculated from:
- Token usage (base scaling)
- Session count (neurons, memory)
- Memory file count (long-term memory)
- Model capabilities (from modelMapper)
- Benchmark scores (from modelBenchmark)

### Achievement System (`achievements.json`)

5 categories:
- `milestone` - First interactions, consecutive days
- `brain` - Neurons, memory scores
- `skill` - Skill count, level milestones
- `explore` - Age, midnight usage, memory files
- `social` - Sessions, interactions, deep talks

Condition types:
- `stat_gte` - Stat >= value
- `exists` - Stat exists
- `first_meet` - First interaction

### Memory Scoring (`memoryScore.ts`)

3-layer evaluation:
- **L1**: Core files (MEMORY.md, SOUL.md, etc.)
- **L2**: Agent files (AGENTS.md, TASKS.md, etc.)
- **L3**: Session files

Scoring dimensions:
- Completeness (file existence)
- Quality (content structure)
- Index health (vector store status)

### LLM Milestone Generation (`llmMilestoneCron.ts`)

- Runs every 6 hours via cron
- Generates 8 dynamic milestone cards via OpenClaw
- Categories: growth, brain, skills, exploration, social, flow, guardian, evolution
- Cached in `backend/data/llm-milestones.json`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 13000 | Backend port |
| `OPENCLAW_DIR` | `~/.openclaw` | OpenClaw data directory |

## Data Flow

```
OpenClaw Data → Backend Services → API → Frontend
     ↓                ↓              ↓        ↓
~/.openclaw/    Processing      /lobster/*  React UI
- agents/       - tokenStats    REST        - Tabs
- skills/       - memoryScore   JSON        - Charts
- memory/       - milestones                - Interactions
- sessions/     - visualization
```

## Security Considerations

1. **No authentication** - Local development only
2. **CORS enabled** - `app.use('*', cors())`
3. **File system access** - Reads `~/.openclaw/`, writes to project `data/`
4. **No input sanitization** - Internal tool assumption

## Common Development Tasks

### Adding a New Achievement

1. Edit `backend/data/achievements.json`:
```json
{
  "id": "my_achievement",
  "name": "My Achievement",
  "description": "Description",
  "icon": "🏅",
  "category": "explore",
  "condition": { "type": "stat_gte", "stat": "level", "value": 10 },
  "order": 100
}
```

2. Add unlock logic in `persistence.ts` if needed

### Adding a New API Endpoint

1. Add route in `backend/src/app.ts`:
```typescript
app.get('/lobster/new-endpoint', async (c) => {
  const data = await someService();
  return c.json({ code: 0, data });
});
```

2. Add client method in `frontend/src/api.ts`:
```typescript
export async function getNewEndpoint(): Promise<NewType> {
  return request('/lobster/new-endpoint');
}
```

3. Add type in `frontend/src/types.ts` and `backend/src/types.ts`

### Modifying State Engine

1. Update `backend/src/services/lobsterStateEngine.ts`
2. Update computed values in `backend/src/app.ts` (`/lobster/stats` endpoint)
3. Update frontend display in `frontend/src/pages/LobsterPage.tsx`

## Troubleshooting

### Backend won't start
- Check Bun version: `bun --version` (need 1.0+)
- Check port 13000 availability
- Verify `~/.openclaw/` exists

### Frontend build fails
- Check Node version: 18+
- Clear node_modules: `rm -rf node_modules && npm install`

### Data not updating
- Check backend logs for errors
- Verify file permissions in `data/` directory
- Clear caches (restart services)

### OpenClaw integration issues
- Verify `~/.openclaw/openclaw.json` exists
- Check agent sessions in `~/.openclaw/agents/*/sessions/`

## Related Documentation

- `README.md` - User-facing documentation (Chinese)
- `SPEC.md` - Detailed feature specifications (Chinese)
- `PROJECT_STATE.md` - Current development status
