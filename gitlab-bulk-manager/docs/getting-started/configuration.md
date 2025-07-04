# Configuration Guide

This guide covers all configuration options for the GitLab Bulk Manager.

## Backend Configuration

### Environment Variables

The backend uses environment variables for configuration. Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

### Configuration Options

#### Server Configuration
```env
# Port where the backend server will run
PORT=4000

# Environment mode
NODE_ENV=development  # Options: development, production, test

# Log level
LOG_LEVEL=info  # Options: error, warn, info, debug
```

#### Session Configuration
```env
# Session secret - MUST be changed in production
SESSION_SECRET=your-very-secure-random-string-here

# Session timeout (in milliseconds)
SESSION_TIMEOUT=86400000  # 24 hours

# Session cookie settings
SESSION_COOKIE_SECURE=false  # Set to true in production with HTTPS
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SAME_SITE=strict
```

#### Redis Configuration (Optional)
```env
# Redis URL for session storage (optional - uses memory store if not provided)
REDIS_URL=redis://localhost:6379

# Redis password (if required)
REDIS_PASSWORD=your-redis-password

# Redis database number
REDIS_DB=0
```

#### CORS Configuration
```env
# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Additional allowed origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Rate Limiting
```env
# Rate limit window in milliseconds
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Maximum requests per window
RATE_LIMIT_MAX_REQUESTS=100

# Skip rate limiting for specific IPs (comma-separated)
RATE_LIMIT_SKIP_IPS=127.0.0.1,::1
```

#### Security Configuration
```env
# Request size limits
MAX_REQUEST_SIZE=10mb
MAX_FILE_SIZE=50mb

# Security headers
HELMET_CSP_ENABLED=true
HELMET_HSTS_ENABLED=true
```

#### WebSocket Configuration
```env
# WebSocket settings
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/socket.io
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000
```

#### Job Queue Configuration
```env
# Maximum concurrent jobs
MAX_CONCURRENT_JOBS=5

# Job timeout in milliseconds
JOB_TIMEOUT=300000  # 5 minutes

# Job retry attempts
JOB_MAX_RETRIES=3
```

## Frontend Configuration

### Build-time Configuration

Frontend configuration is set through environment variables during build:

#### Development
Create `.env.development` in the `frontend` directory:
```env
# API URL
VITE_API_URL=http://localhost:4000

# WebSocket URL
VITE_WS_URL=http://localhost:4000

# App settings
VITE_APP_TITLE=GitLab Bulk Manager
VITE_APP_VERSION=1.0.0

# Feature flags
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_DRAG_DROP=true
VITE_ENABLE_BULK_OPERATIONS=true
```

#### Production
Create `.env.production`:
```env
# API URL (relative for same-origin)
VITE_API_URL=/api

# WebSocket URL
VITE_WS_URL=/

# App settings
VITE_APP_TITLE=GitLab Bulk Manager
VITE_APP_VERSION=1.0.0

# Feature flags
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_DRAG_DROP=true
VITE_ENABLE_BULK_OPERATIONS=true
```

### Runtime Configuration

Some settings can be configured at runtime through the UI:

1. **Theme**: Light/Dark mode (stored in localStorage)
2. **Language**: i18n settings (stored in localStorage)
3. **View Preferences**: List/Grid view, items per page
4. **Notification Settings**: Enable/disable notifications

## GitLab Configuration

### Personal Access Token Requirements

The GitLab PAT must have the following scopes:
- `api` - Full API access
- `read_api` - Read access to the API  
- `read_repository` - Read repository data
- `write_repository` - Write repository data

### GitLab API Settings

Configure GitLab API behavior in the backend:

```env
# GitLab API rate limits
GITLAB_API_RATE_LIMIT=10  # Requests per second
GITLAB_API_TIMEOUT=30000   # 30 seconds

# GitLab API retry settings
GITLAB_API_MAX_RETRIES=3
GITLAB_API_RETRY_DELAY=1000  # 1 second
```

## Production Configuration

### Security Checklist

For production deployment, ensure:

1. **Session Security**
   ```env
   SESSION_SECRET=<generate-strong-random-string>
   SESSION_COOKIE_SECURE=true
   NODE_ENV=production
   ```

2. **HTTPS Configuration**
   - Use HTTPS for all connections
   - Set secure cookie flags
   - Configure proper CORS origins

3. **Rate Limiting**
   ```env
   RATE_LIMIT_MAX_REQUESTS=60  # Lower for production
   ```

4. **Monitoring**
   ```env
   LOG_LEVEL=warn  # Less verbose in production
   ENABLE_METRICS=true
   METRICS_PORT=9090
   ```

### Performance Optimization

```env
# Enable compression
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6

# Cache settings
CACHE_ENABLED=true
CACHE_TTL=3600  # 1 hour

# Database pooling (if using external session store)
DB_POOL_MIN=2
DB_POOL_MAX=10
```

## Docker Configuration

When using Docker, pass environment variables through docker-compose:

```yaml
version: '3.8'
services:
  backend:
    environment:
      - PORT=4000
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=https://gitlab-manager.example.com
  
  frontend:
    build:
      args:
        - VITE_API_URL=/api
        - VITE_WS_URL=/
```

## Configuration Validation

The application validates configuration on startup:

1. **Required Variables**: Checks for essential configs
2. **Type Validation**: Ensures correct data types
3. **Range Validation**: Validates numeric ranges
4. **Connection Tests**: Tests Redis/database connections

## Troubleshooting Configuration

### Common Issues

1. **Session Not Persisting**
   - Check `SESSION_SECRET` is set
   - Verify Redis connection if using
   - Ensure cookies are enabled

2. **CORS Errors**
   - Verify `FRONTEND_URL` matches actual frontend URL
   - Check `ALLOWED_ORIGINS` includes all necessary origins

3. **WebSocket Connection Failed**
   - Ensure `WEBSOCKET_ENABLED=true`
   - Check firewall rules for WebSocket port
   - Verify proxy configuration passes WebSocket upgrades

4. **Rate Limiting Too Strict**
   - Increase `RATE_LIMIT_MAX_REQUESTS`
   - Add trusted IPs to `RATE_LIMIT_SKIP_IPS`

## Next Steps

- Continue to the [Quick Start Tutorial](./quick-start.md)
- Review [Security Architecture](../architecture/security.md)
- Set up [Monitoring](../maintenance/monitoring.md)