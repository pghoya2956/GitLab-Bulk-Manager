# GitLab Bulk Manager - Multi-stage Dockerfile
# Frontend (React) + Backend (Express) combined image

# ============================
# Stage 1: Frontend Build
# ============================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first (better cache)
COPY frontend/package*.json ./
RUN npm ci

# Build frontend
COPY frontend/ ./
# Frontend uses import.meta.env.PROD to detect production mode
# No VITE_API_URL needed - it will use relative URLs in production
RUN npm run build

# ============================
# Stage 2: Production Image
# ============================
FROM node:20-alpine AS production

WORKDIR /app

# Install nginx for serving frontend
RUN apk add --no-cache nginx

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/src ./backend/src

# Copy documentation files for backend to serve
COPY frontend/docs ./docs

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Copy nginx config
COPY infra/app/nginx.conf /etc/nginx/http.d/default.conf

# Copy entrypoint script
COPY infra/app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment
ENV NODE_ENV=production
ENV PORT=4050

# Expose ports
# 80: nginx (frontend)
# 4050: backend API
EXPOSE 80 4050

ENTRYPOINT ["/entrypoint.sh"]
