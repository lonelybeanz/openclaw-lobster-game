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

## View

<img width="1812" height="1284" alt="image" src="https://github.com/user-attachments/assets/640f6c19-7751-42e0-b916-12bb69eaea65" />


## License

MIT
