# Deployment Guide

## Build Process

### Production Build
```bash
# Install dependencies
npm ci --production=false

# Run production build
npm run build

# Output will be in dist/ directory
```

### Build Configuration
The build process uses Vite with the following optimizations:
- Tree shaking
- Code splitting
- Asset optimization
- Minification
- Source map generation (optional)

### Environment Variables
Create `.env.production`:
```env
VITE_API_URL=https://api.gitlab-manager.com
VITE_WS_URL=wss://api.gitlab-manager.com
VITE_ENABLE_DEVTOOLS=false
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name gitlab-manager.example.com;
    root /var/www/gitlab-manager;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/json application/xml+rss;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

#### Apache Configuration
```apache
<VirtualHost *:80>
    ServerName gitlab-manager.example.com
    DocumentRoot /var/www/gitlab-manager

    # Enable compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
    </IfModule>

    # Cache control
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>

    # SPA routing
    <Directory /var/www/gitlab-manager>
        Options -MultiViews
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteRule ^ index.html [QSA,L]
    </Directory>

    # Security headers
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
</VirtualHost>
```

### Option 2: Docker Deployment

#### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build application
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${API_URL}
    ports:
      - "80:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - GITLAB_URL=${GITLAB_URL}
      - GITLAB_TOKEN=${GITLAB_TOKEN}
    restart: unless-stopped
```

### Option 3: Cloud Platforms

#### Vercel
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

Deploy command:
```bash
vercel --prod
```

#### Netlify
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

#### AWS S3 + CloudFront
```bash
# Build application
npm run build

# Sync to S3
aws s3 sync dist/ s3://gitlab-manager-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id ABCDEFG \
  --paths "/*"
```

CloudFront configuration:
- Origin: S3 bucket
- Default root object: index.html
- Error pages: 404 → /index.html (200 status)

## CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build application
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
      
      - name: Deploy to S3
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} --paths "/*"
```

### GitLab CI
```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"

test:
  stage: test
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm test
  cache:
    paths:
      - node_modules/

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
  only:
    - main

deploy:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache rsync openssh
  script:
    - rsync -avz --delete dist/ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}
  only:
    - main
```

## Environment Configuration

### Production Environment Variables
```bash
# Backend API
VITE_API_URL=https://api.gitlab-manager.com
VITE_WS_URL=wss://api.gitlab-manager.com

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true

# Third-party services
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Security Configuration
1. **HTTPS**: Always use HTTPS in production
2. **CSP Headers**: Configure Content Security Policy
3. **CORS**: Properly configure CORS on backend
4. **Secrets**: Never commit secrets to repository

## Monitoring and Analytics

### Error Tracking (Sentry)
```typescript
// src/utils/sentry.ts
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay()
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

### Analytics (Google Analytics)
```html
<!-- index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Performance Monitoring
```typescript
// Monitor Core Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

## Health Checks

### Frontend Health Check
Create `public/health.json`:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Monitoring Endpoints
- `/health.json` - Basic health check
- `/version.json` - Version information
- `/robots.txt` - Search engine configuration

## Rollback Strategy

### Version Management
1. Tag each release in Git
2. Keep previous build artifacts
3. Document database migrations
4. Test rollback procedures

### Quick Rollback
```bash
# Using Git tags
git checkout v1.2.3
npm ci
npm run build
# Deploy build

# Using Docker
docker pull gitlab-manager:v1.2.3
docker-compose up -d

# Using S3 versioning
aws s3 sync s3://gitlab-manager-backup/v1.2.3/ s3://gitlab-manager-prod/
```

## Performance Optimization

### CDN Configuration
1. **Static Assets**: Serve from CDN
2. **API Caching**: Configure appropriate cache headers
3. **Compression**: Enable gzip/brotli
4. **HTTP/2**: Enable for better performance

### Bundle Optimization
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material'],
          utils: ['lodash', 'date-fns']
        }
      }
    }
  }
});
```

## Post-Deployment

### Verification Checklist
- [ ] Application loads correctly
- [ ] Authentication works
- [ ] API connections established
- [ ] WebSocket connections work
- [ ] All features functional
- [ ] No console errors
- [ ] Performance acceptable
- [ ] SSL certificate valid

### Monitoring Setup
1. Set up uptime monitoring
2. Configure error alerts
3. Monitor API response times
4. Track user analytics
5. Set up log aggregation

### Backup Strategy
- Regular database backups
- Configuration backups
- Document recovery procedures
- Test restore process