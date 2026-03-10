#!/bin/bash
# lobster-plugin 启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🦞 启动 Lobster Plugin 开发环境..."

# 后端
echo "📦 安装后端依赖..."
cd "$SCRIPT_DIR/backend"
bun install

# 创建 data 目录
mkdir -p "$SCRIPT_DIR/backend/data"

echo "🚀 启动后端 (端口 3000)..."
bun run dev &
BACKEND_PID=$!

# 前端
echo "📦 安装前端依赖..."
cd "$SCRIPT_DIR/frontend"
npm install

echo "🚀 启动前端 (端口 5173)..."
npm run dev &
FRONTEND_PID=$!

cd "$SCRIPT_DIR"

echo "✅ 启动完成!"
echo "   后端: http://localhost:3000"
echo "   前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待 Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
