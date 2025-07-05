#!/bin/bash

# GitLab Bulk Manager - Quick Start Script
# This script starts both backend and frontend servers

echo "🚀 Starting GitLab Bulk Manager..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}🔄 Killing existing process on port $port...${NC}"
        kill -9 $pids 2>/dev/null
        sleep 1
    fi
}

# Clean up existing processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
kill_port 3000  # Frontend port
kill_port 4000  # Backend port

# Also kill any node processes running our scripts
pkill -f "node.*backend/src/index.js" 2>/dev/null
pkill -f "vite.*frontend" 2>/dev/null

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚙️  Creating backend .env file...${NC}"
    cp backend/.env.example backend/.env 2>/dev/null || true
fi

# Create logs directory
mkdir -p logs

# Start backend server in background
echo -e "${GREEN}🚀 Starting backend server on port 4000...${NC}"
cd backend
nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Save PID for stop script
echo $BACKEND_PID > .backend.pid

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:4000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on http://localhost:4000${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start frontend server in background
echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Save PID for stop script
echo $FRONTEND_PID > .frontend.pid

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is running on http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start. Check logs/frontend.log${NC}"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""

echo ""
echo -e "${GREEN}✅ GitLab Bulk Manager is running!${NC}"
echo ""
echo -e "🌐 Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "🔧 Backend:  ${GREEN}http://localhost:4000${NC}"
echo -e "📄 Logs:     ${YELLOW}logs/backend.log${NC} and ${YELLOW}logs/frontend.log${NC}"
echo ""
echo -e "${YELLOW}To stop all servers:   ./stop.sh${NC}"
echo -e "${YELLOW}To view logs:          tail -f logs/*.log${NC}"
echo -e "${YELLOW}To restart:            ./stop.sh && ./start.sh${NC}"
echo ""

# Exit successfully (servers continue running in background)
exit 0