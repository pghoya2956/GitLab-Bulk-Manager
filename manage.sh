#!/bin/bash

# GitLab Bulk Manager - Management Script
# Usage: ./manage.sh [start|stop|restart|status|logs]

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=3000
BACKEND_PORT=4000
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"
LOG_DIR="logs"

# Print usage
usage() {
    printf "${BLUE}GitLab Bulk Manager - Management Script${NC}\n"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start all services"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  status   - Show service status"
    echo "  logs     - Tail all logs"
    echo ""
}

# Check prerequisites
check_requirements() {
    if ! command -v node &> /dev/null; then
        printf "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        printf "${RED}❌ npm is not installed. Please install npm first.${NC}"
        exit 1
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        printf "${YELLOW}🔄 Killing existing process on port $port...${NC}"
        kill -9 $pids 2>/dev/null
        sleep 1
    fi
}

# Stop all services
stop_services() {
    printf "${YELLOW}🛑 Stopping GitLab Bulk Manager...${NC}"
    echo ""

    # Stop using saved PIDs if available
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat $BACKEND_PID_FILE)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            printf "${YELLOW}Stopping backend server (PID: $BACKEND_PID)...${NC}"
            kill -9 $BACKEND_PID 2>/dev/null
        fi
        rm -f $BACKEND_PID_FILE
    fi

    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat $FRONTEND_PID_FILE)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            printf "${YELLOW}Stopping frontend server (PID: $FRONTEND_PID)...${NC}"
            kill -9 $FRONTEND_PID 2>/dev/null
        fi
        rm -f $FRONTEND_PID_FILE
    fi


    # Also try to kill by port
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT

    # Kill any remaining node processes
    pkill -f "node.*backend/src/index.js" 2>/dev/null
    pkill -f "vite.*frontend" 2>/dev/null

    printf "${GREEN}✅ All services stopped!${NC}"
    echo ""
}

# Start all services
start_services() {
    printf "${GREEN}🚀 Starting GitLab Bulk Manager...${NC}"
    echo ""

    # Clean up any existing processes first
    printf "${YELLOW}🧹 Cleaning up existing processes...${NC}"
    kill_port $FRONTEND_PORT
    kill_port $BACKEND_PORT
    pkill -f "node.*backend/src/index.js" 2>/dev/null
    pkill -f "vite.*frontend" 2>/dev/null

    # Check if backend dependencies are installed
    if [ ! -d "backend/node_modules" ]; then
        printf "${YELLOW}📦 Installing backend dependencies...${NC}"
        cd backend && npm install && cd ..
    fi

    # Check if frontend dependencies are installed
    if [ ! -d "frontend/node_modules" ]; then
        printf "${YELLOW}📦 Installing frontend dependencies...${NC}"
        cd frontend && npm install && cd ..
    fi


    # Check if backend .env exists
    if [ ! -f "backend/.env" ]; then
        printf "${YELLOW}⚙️  Creating backend .env file...${NC}"
        cp backend/.env.example backend/.env 2>/dev/null || true
    fi


    # Create logs directory
    mkdir -p $LOG_DIR

    # Start backend server in background
    printf "${GREEN}🚀 Starting backend server on port $BACKEND_PORT...${NC}"
    cd backend
    nohup npm start > ../$LOG_DIR/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..

    # Save PID
    echo $BACKEND_PID > $BACKEND_PID_FILE

    # Wait for backend to start
    printf "${YELLOW}⏳ Waiting for backend to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            printf "${GREEN}✅ Backend is running on http://localhost:$BACKEND_PORT${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            printf "${RED}❌ Backend failed to start. Check $LOG_DIR/backend.log${NC}"
            exit 1
        fi
        sleep 1
        echo -n "."
    done
    echo ""

    # Start frontend server in background
    printf "${GREEN}🚀 Starting frontend server on port $FRONTEND_PORT...${NC}"
    cd frontend
    nohup npm run dev > ../$LOG_DIR/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..

    # Save PID
    echo $FRONTEND_PID > $FRONTEND_PID_FILE

    # Wait for frontend to start
    printf "${YELLOW}⏳ Waiting for frontend to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            printf "${GREEN}✅ Frontend is running on http://localhost:$FRONTEND_PORT${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            printf "${RED}❌ Frontend failed to start. Check $LOG_DIR/frontend.log${NC}"
            exit 1
        fi
        sleep 1
        echo -n "."
    done
    echo ""


    echo ""
    printf "${GREEN}✅ GitLab Bulk Manager is running!${NC}"
    echo ""
    printf "🌐 Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    printf "🔧 Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
    printf "📄 Logs:     ${YELLOW}$LOG_DIR/backend.log${NC} and ${YELLOW}$LOG_DIR/frontend.log${NC}"
    echo ""
}

# Show service status
show_status() {
    printf "${BLUE}GitLab Bulk Manager - Service Status${NC}"
    echo ""

    # Check backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat $BACKEND_PID_FILE)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            printf "🔧 Backend:  ${GREEN}Running${NC} (PID: $BACKEND_PID, Port: $BACKEND_PORT)"
        else
            printf "🔧 Backend:  ${RED}Stopped${NC} (PID file exists but process not running)"
        fi
    else
        # Check by port
        if lsof -ti:$BACKEND_PORT >/dev/null 2>&1; then
            printf "🔧 Backend:  ${GREEN}Running${NC} (Port: $BACKEND_PORT)"
        else
            printf "🔧 Backend:  ${RED}Stopped${NC}"
        fi
    fi

    # Check frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat $FRONTEND_PID_FILE)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            printf "🌐 Frontend: ${GREEN}Running${NC} (PID: $FRONTEND_PID, Port: $FRONTEND_PORT)"
        else
            printf "🌐 Frontend: ${RED}Stopped${NC} (PID file exists but process not running)"
        fi
    else
        # Check by port
        if lsof -ti:$FRONTEND_PORT >/dev/null 2>&1; then
            printf "🌐 Frontend: ${GREEN}Running${NC} (Port: $FRONTEND_PORT)"
        else
            printf "🌐 Frontend: ${RED}Stopped${NC}"
        fi
    fi


    echo ""
}

# Show logs
show_logs() {
    printf "${BLUE}Following logs from $LOG_DIR/*.log${NC}"
    printf "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    tail -f $LOG_DIR/*.log
}

# Main script logic
check_requirements

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        usage
        exit 1
        ;;
esac