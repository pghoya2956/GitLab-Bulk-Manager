---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🚀 배포 가이드

## 배포 옵션

### 1. Docker 배포 (권장)
컨테이너화된 배포로 일관된 환경을 보장합니다.

### 2. 수동 배포
서버에 직접 애플리케이션을 설치하고 구성합니다.

### 3. 클라우드 플랫폼
AWS, Google Cloud, Azure 등의 관리형 서비스를 사용합니다.

## Docker 배포

### Docker 이미지 빌드

#### 프론트엔드 Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 백엔드 Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Docker Compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://backend:4000

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### 배포 실행
```bash
# 이미지 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

## 프로덕션 환경 설정

### 환경 변수
```bash
# .env.production
NODE_ENV=production
SESSION_SECRET=your-strong-secret-key
REDIS_URL=redis://redis:6379
CORS_ORIGIN=https://your-domain.com
```

### Nginx 설정
```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;

    # 프론트엔드
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }

    # API 프록시
    location /api {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 프록시
    location /socket.io {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## CI/CD 파이프라인

### GitHub Actions 배포
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker images
      run: |
        docker build -t myapp/frontend ./frontend
        docker build -t myapp/backend ./backend
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Push images
      run: |
        docker push myapp/frontend
        docker push myapp/backend
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /opt/gitlab-bulk-manager
          docker-compose pull
          docker-compose up -d
```

## Kubernetes 배포

### 배포 매니페스트
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitlab-bulk-manager
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gitlab-bulk-manager
  template:
    metadata:
      labels:
        app: gitlab-bulk-manager
    spec:
      containers:
      - name: frontend
        image: myapp/frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: VITE_API_URL
          value: "http://backend-service:4000"
      
      - name: backend
        image: myapp/backend:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: session-secret
```

### 서비스 정의
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  selector:
    app: gitlab-bulk-manager
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer

---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: gitlab-bulk-manager
  ports:
  - protocol: TCP
    port: 4000
    targetPort: 4000
```

## SSL/TLS 설정

### Let's Encrypt 인증서
```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 자동 갱신 설정
sudo systemctl enable certbot.timer
```

### Nginx HTTPS 설정
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # 나머지 설정...
}

# HTTP를 HTTPS로 리다이렉트
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 모니터링 및 로깅

### 프로메테우스 설정
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gitlab-bulk-manager'
    static_configs:
    - targets: ['backend:4000']
```

### 애플리케이션 메트릭
```typescript
// backend/src/metrics.ts
import { register, Counter, Histogram } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
```

### 로그 수집
```yaml
# docker-compose.yml 추가
  elk:
    image: sebp/elk
    ports:
      - "5601:5601"
      - "9200:9200"
      - "5044:5044"
    volumes:
      - elk-data:/var/lib/elasticsearch

volumes:
  elk-data:
```

## 백업 및 복구

### 데이터베이스 백업
```bash
#!/bin/bash
# backup.sh

# Redis 백업
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb

# 세션 데이터 백업
tar -czf ./backups/sessions-$(date +%Y%m%d).tar.gz /var/lib/sessions
```

### 자동 백업 크론
```bash
# crontab -e
0 2 * * * /opt/scripts/backup.sh
```

## 성능 최적화

### CDN 설정
```nginx
# 정적 자산 캐싱
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Gzip 압축
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

## 보안 강화

### 보안 헤더
```nginx
# 보안 헤더 추가
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

### 방화벽 설정
```bash
# UFW 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

## 문제 해결

### 일반적인 배포 문제

#### 포트 충돌
```bash
# 사용 중인 포트 확인
sudo netstat -tulpn | grep LISTEN
```

#### Docker 권한 문제
```bash
# Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER
```

#### 메모리 부족
```bash
# Docker 메모리 제한 설정
docker run -m 512m myapp/backend
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [테스팅](./testing.md) | [한국어 문서](./README.md) | [API 통합](./api-integration.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/deployment.md)**

</div>