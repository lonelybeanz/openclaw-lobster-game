#!/bin/bash
# lobster-plugin 启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🦞 启动 Lobster Plugin 开发环境..."

# 后端
echo "📦 启动后端..."
cd "$SCRIPT_DIR/backend"
PORT=13000 bun index.ts &
BACKEND_PID=$!

# 前端
echo "📦 启动前端..."
cd "$SCRIPT_DIR/frontend"
PORT=15173 npm run dev &
FRONTEND_PID=$!

cd "$SCRIPT_DIR"

echo "✅ 启动完成!"
echo "   后端: http://localhost:13000"
echo "   前端: http://localhost:15173"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
