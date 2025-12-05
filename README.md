# GitLab Bulk Manager

> GitLab 그룹 및 프로젝트를 대량으로 관리하는 웹 애플리케이션

## 🚀 빠른 시작

```bash
# 개발 환경 실행 (기본, 핫리로드 지원)
docker compose up -d

# 브라우저에서 접속
open http://localhost:3030

# 프로덕션 환경 실행
docker compose -f docker-compose.prod.yml up -d
```

## 📋 주요 기능

### 대량 작업
- **대량 생성**: YAML 템플릿으로 그룹/프로젝트 계층 구조 일괄 생성
- **대량 전송**: 여러 프로젝트/그룹을 다른 네임스페이스로 일괄 이동
- **대량 삭제**: 체크박스로 선택한 항목들 일괄 삭제 (실시간 진행률 표시)
- **대량 아카이브/복원**: 프로젝트 일괄 아카이브 및 언아카이브
- **대량 복제**: 프로젝트/그룹 일괄 복사

### 설정 관리
- **가시성 변경**: Public/Internal/Private 일괄 변경
- **CI/CD 설정 동기화**: 템플릿 프로젝트 설정을 다른 프로젝트에 적용
- **권한 관리**: 멤버 권한 일괄 설정 및 변경
- **이슈/MR 관리**: 이슈와 머지 리퀘스트 일괄 생성/수정

### UI 기능
- **트리 뷰**: GitLab 구조를 계층적으로 시각화
- **체크박스 선택**: 부모-자식 연동 다중 선택
- **실시간 진행률**: WebSocket을 통한 작업 진행 상황 표시
- **작업 히스토리**: 최근 작업 내역 자동 저장 및 표시
- **필터링**: 아카이브된 프로젝트 및 삭제 예정 그룹 자동 필터

## 🏗️ 시스템 아키텍처

```
GitLab Bulk Manager
├── Frontend (Port 3030)
│   ├── React 18 + TypeScript
│   ├── Material-UI v5
│   ├── Redux Toolkit (상태 관리)
│   ├── Socket.IO Client (실시간 통신)
│   └── Vite (번들러)
│
├── Backend (Port 4050)
│   ├── Node.js + Express (ES Modules)
│   ├── Session 기반 인증
│   ├── GitLab API 프록시
│   ├── WebSocket 서버
│   └── Winston 로거
│
└── Redis (Port 6379)
    └── 세션 스토리지
```

## 📦 설치 및 실행

### Docker Compose 사용 (권장)

```bash
# 1. 저장소 클론
git clone <repository-url>
cd gitlab-bulk-manager

# 2. 개발 환경 실행 (기본, 핫리로드 지원)
docker compose up -d
# - Backend: nodemon으로 자동 재시작
# - Frontend: Vite dev server로 HMR 지원
# - 코드 변경 시 자동 반영
# - 첫 실행 시 자동으로 npm install 수행

# 3. 프로덕션 환경 실행
docker compose -f docker-compose.prod.yml up -d
# - 최적화된 빌드 (Multi-stage Docker build)
# - Frontend: Nginx로 정적 파일 서빙
# - Backend: Node.js 프로덕션 모드
# - 보안 강화 (non-root user)

# 4. 상태 확인
docker compose ps
docker compose logs -f  # 실시간 로그
docker compose logs -f backend  # Backend 로그만
docker compose logs -f frontend  # Frontend 로그만

# 5. 중지
docker compose down
# 볼륨 포함 삭제: docker compose down -v
```

### 수동 설치 (Docker 없이)

```bash
# 1. Redis 설치 및 실행 (필수)
redis-server

# 2. Backend 실행
cd backend
npm install
npm run dev  # 개발 모드 (nodemon)
# 또는
npm start    # 프로덕션 모드

# 3. Frontend 실행 (새 터미널)
cd frontend
npm install
npm run dev  # 개발 서버 (Vite HMR)
# 또는
npm run build && npm run preview  # 프로덕션 빌드
```

## 🔧 환경 설정

### Backend 환경 변수 (backend/.env)

```bash
# 서버 설정
PORT=4050                    # Backend 포트 (기본: 4050)
NODE_ENV=development         # 환경 (development/production)

# 세션 설정
SESSION_SECRET=your-secret-here  # 세션 암호화 키 (필수)

# Redis 설정 (선택사항)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# CORS 설정
FRONTEND_URL=http://localhost:3030

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000    # 15분
RATE_LIMIT_MAX_REQUESTS=100    # 최대 요청 수

# 로깅
LOG_LEVEL=info                  # debug, info, warn, error
```

### Frontend 환경 변수 (frontend/.env)

```bash
# API 설정
VITE_API_URL=http://localhost:4050

# WebSocket 설정
VITE_WS_URL=ws://localhost:4050
VITE_ENABLE_WEBSOCKET=true      # 실시간 진행률 활성화

# 앱 설정
VITE_APP_NAME=GitLab Bulk Manager
VITE_APP_VERSION=1.0.0
```

## 📖 문서

자세한 문서는 [docs](./docs) 폴더를 참조하세요:

- [시스템 아키텍처](./docs/architecture/README.md)
- [API 문서](./docs/api/README.md)
- [배포 가이드](./docs/deployment/README.md)
- [운영 가이드](./docs/operations/README.md)

## 🛠️ 개발

### 개발 환경 실행

```bash
# Docker Compose로 개발 환경 실행 (기본값)
docker compose up -d

# 변경사항이 자동으로 반영됨:
# - Backend: nodemon이 파일 변경 감지하여 자동 재시작
# - Frontend: Vite HMR로 즉시 반영
# - 볼륨 마운트로 로컬 코드와 컨테이너 동기화

# 백그라운드 실행 대신 로그 보기
docker compose up  # Ctrl+C로 종료
```

### 테스트 실행

```bash
# 컨테이너 내부에서 테스트 실행
docker compose exec backend npm test
docker compose exec frontend npm test

# 또는 로컬에서 직접 실행
cd backend && npm test
cd frontend && npm test
```

### 코드 품질 검사

```bash
# 컨테이너 내부에서 실행
docker compose exec backend npm run lint:fix
docker compose exec frontend npm run lint:fix

# Frontend 포맷팅
docker compose exec frontend npm run format
```

## 🔒 보안 기능

- **토큰 보안**: GitLab Personal Access Token은 서버 세션에만 저장
- **세션 암호화**: Redis에 암호화된 세션 데이터 저장
- **HTTPS 지원**: 프로덕션 환경에서 HTTPS 사용 권장
- **Rate Limiting**: API 요청 제한으로 남용 방지
- **CORS 설정**: 허용된 출처만 API 접근 가능
- **입력 검증**: 모든 사용자 입력 검증 및 sanitize

## 🚀 최근 개선사항 (2025-01-11)

1. **API 라우터 통합**: 중복된 bulkActions.js 제거, bulk.js로 일원화
2. **세션 키 통일**: 모든 파일에서 `req.session.gitlabToken` 사용
3. **실시간 진행률**: WebSocket을 통한 대량 작업 진행 상황 표시
4. **API 경로 수정**: `/api/gitlab/bulk/*` 경로로 통일
5. **UI 개선**: 체크박스 선택, 작업 히스토리, 자동 펼침 기능

## 📝 라이선스

MIT License

## 🤝 기여 방법

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🆘 문제 해결

### 자주 발생하는 문제

**포트 충돌 문제**
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3030  # Frontend
lsof -i :4050  # Backend

# Docker 컨테이너 재시작
docker compose down
docker compose up -d
```

**의존성 설치 실패**
```bash
# Docker 볼륨과 node_modules 재생성
docker compose down -v
docker compose up -d --build
```

**세션 유지 안됨**
- `SESSION_SECRET` 환경 변수 설정 확인
- Redis 연결 상태 확인
- 브라우저 쿠키 설정 확인

## 📚 추가 리소스

- [GitLab API 문서](https://docs.gitlab.com/ee/api/)
- [프로젝트 Wiki](./docs/README.md)
- [이슈 트래커](https://github.com/gitlab-bulk-manager/issues)

