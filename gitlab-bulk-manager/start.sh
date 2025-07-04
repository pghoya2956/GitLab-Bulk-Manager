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

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

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
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your configuration${NC}"
fi

# Check if ports are available
if check_port 4000; then
    echo -e "${RED}❌ Port 4000 is already in use (backend)${NC}"
    echo "Please stop the process using port 4000 or change the port in backend/.env"
    exit 1
fi

if check_port 3000; then
    echo -e "${RED}❌ Port 3000 is already in use (frontend)${NC}"
    echo "Please stop the process using port 3000"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start backend server
echo -e "${GREEN}🚀 Starting backend server on port 4000...${NC}"
cd backend && npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 3

# Check if backend started successfully
if ! check_port 4000; then
    echo -e "${RED}❌ Backend failed to start. Check the logs above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend is running on http://localhost:4000${NC}"

# Start frontend server
echo -e "${GREEN}🚀 Starting frontend server on port 3000...${NC}"
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 5

# Check if frontend started successfully
if ! check_port 3000; then
    echo -e "${RED}❌ Frontend failed to start. Check the logs above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ GitLab Bulk Manager is running!${NC}"
echo ""
echo -e "🌐 Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "🔧 Backend:  ${GREEN}http://localhost:4000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Keep the script running
wait