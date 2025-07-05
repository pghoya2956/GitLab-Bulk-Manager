#!/bin/bash

# GitLab Bulk Manager - Stop Script
# This script stops both backend and frontend servers

echo "🛑 Stopping GitLab Bulk Manager..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}Stopping process on port $port...${NC}"
        kill -9 $pids 2>/dev/null
        return 0
    else
        return 1
    fi
}

# Stop using saved PIDs if available
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${YELLOW}Stopping backend server (PID: $BACKEND_PID)...${NC}"
        kill -9 $BACKEND_PID 2>/dev/null
    fi
    rm -f .backend.pid
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${YELLOW}Stopping frontend server (PID: $FRONTEND_PID)...${NC}"
        kill -9 $FRONTEND_PID 2>/dev/null
    fi
    rm -f .frontend.pid
fi

# Also try to kill by port
kill_port 4000 && echo -e "${GREEN}✅ Backend stopped${NC}"
kill_port 3000 && echo -e "${GREEN}✅ Frontend stopped${NC}"

# Kill any remaining node processes
pkill -f "node.*backend/src/index.js" 2>/dev/null
pkill -f "vite.*frontend" 2>/dev/null

echo ""
echo -e "${GREEN}✅ All services stopped!${NC}"
echo ""