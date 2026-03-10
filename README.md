# 🦞 OpenClaw Lobster Game

A gamified OpenClaw instance management plugin - raise your own AI assistant!

## Features

- 📊 **Stats Visualization**: Level, experience, skills, memory
- 🎮 **Game-like UI**: Beautiful dark theme with glassmorphism
- 💬 **Interactive**: Feed, train, rest your lobster
- 🔒 **Local Only**: All data stays on your machine

## Quick Start

```bash
# Backend
cd backend
bun install
bun run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Data Source

Reads from local OpenClaw:
- `~/.openclaw/openclaw.json` - name, avatar, personality
- `~/.openclaw/skills/` - skill count
- `~/.openclaw/workspace/memory/` - memory quality
- `openclaw sessions` CLI - token usage

## License

MIT
