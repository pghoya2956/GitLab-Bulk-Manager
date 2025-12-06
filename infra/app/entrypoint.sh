#!/bin/sh
set -e

echo "Starting GitLab Bulk Manager..."

# Start backend in background
echo "Starting backend server on port 4050..."
cd /app/backend
node src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
sleep 3

# Start nginx in foreground
echo "Starting nginx on port 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Handle signals for graceful shutdown
trap "echo 'Shutting down...'; kill $BACKEND_PID $NGINX_PID; exit 0" SIGTERM SIGINT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
