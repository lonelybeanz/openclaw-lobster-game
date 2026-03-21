#!/bin/bash
# lobster-plugin 启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Config ---
BACKEND_PORT=13000
FRONTEND_PORT=15173
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# --- Functions ---

# Function to kill a process by port.
kill_by_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -t -i:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo "   🛑 Stopping $name on port $port (PID(s): $pids)..."
        echo "$pids" | xargs kill
    fi
}

start_backend() {
    echo "📦 Starting backend in foreground..."
    cd "$BACKEND_DIR"
    PORT=$BACKEND_PORT bun index.ts
}

start_frontend() {
    echo "📦 Starting frontend in foreground..."
    cd "$FRONTEND_DIR"
    PORT=$FRONTEND_PORT npm run dev
}

stop_all() {
    echo "🦞 Stopping all services..."
    kill_by_port $BACKEND_PORT "backend"
    kill_by_port $FRONTEND_PORT "frontend"
    echo "✅ All services stopped."
}

show_help() {
    echo "🦞 Lobster Plugin Development Environment Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  <none>    Start both backend and frontend in the background."
    echo "  all       Alias for the default command."
    echo "  backend   Stop the existing backend and run it in the foreground."
    echo "  frontend  Stop the existing frontend and run it in the foreground."
    echo "  restart   Cleanly restart all services in the background."
    echo "  stop      Stop all running services."
    echo "  help      Show this help message."
    echo ""
}

# --- Main Logic ---

case "$1" in
    backend)
        trap "kill_by_port $BACKEND_PORT 'backend'; exit" INT TERM
        kill_by_port $BACKEND_PORT "backend"
        sleep 1 # Give port time to be released
        start_backend
        ;;
    frontend)
        trap "kill_by_port $FRONTEND_PORT 'frontend'; exit" INT TERM
        kill_by_port $FRONTEND_PORT "frontend"
        sleep 1 # Give port time to be released
        start_frontend
        ;;
    stop)
        stop_all
        ;;
    restart|""|all)
        # Main entrypoint for running everything
        trap 'echo ""; stop_all; exit 0' INT TERM
        
        if [ "$1" = "restart" ]; then
            echo "🔄 Restarting all services..."
        else
            echo "🦞 Starting Lobster Plugin development environment..."
        fi
        
        stop_all
        sleep 1 # Give ports time to be released

        # Start new processes
        echo "📦 Starting backend in background..."
        cd "$BACKEND_DIR"
        PORT=$BACKEND_PORT bun index.ts &
        BACKEND_PID=$!
        
        echo "📦 Starting frontend in background..."
        cd "$FRONTEND_DIR"
        PORT=$FRONTEND_PORT npm run dev &
        FRONTEND_PID=$!

        cd "$SCRIPT_DIR"
        
        echo ""
        echo "✅ Services started!"
        echo "   Backend:  http://localhost:$BACKEND_PORT (PID: $BACKEND_PID)"
        echo "   Frontend: http://localhost:$FRONTEND_PORT (PID: $FRONTEND_PID)"
        echo ""
        echo "Press Ctrl+C to stop all services."
        
        # Wait for the background processes to prevent script exit
        wait
        ;;
    help)
        show_help
        ;;
    *)
        echo "❌ Invalid command: $1"
        show_help
        exit 1
        ;;
esac
