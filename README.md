# GitLab Bulk Manager

> GitLab 그룹 및 프로젝트 대량 관리 도구

## 🚀 빠른 시작

```bash
# Docker Compose로 실행
docker compose up -d

# 브라우저에서 접속
open http://localhost:3030
```

## 📋 주요 기능

- **대량 생성**: YAML 템플릿을 사용한 그룹/프로젝트 일괄 생성
- **대량 전송**: 여러 프로젝트를 다른 그룹으로 일괄 이동
- **대량 삭제**: 선택한 그룹/프로젝트 일괄 삭제
- **트리 뷰**: GitLab 구조를 시각적으로 표시
- **권한 관리**: 멤버 권한 일괄 설정
- **필터링**: 아카이브된 프로젝트 및 삭제 예정 그룹 자동 필터링

## 🏗️ 시스템 구조

```
GitLab Bulk Manager
├── Frontend (React + TypeScript + Material-UI)
├── Backend (Node.js + Express)
└── Cache (Redis)
```

## 📦 설치 및 실행

### Docker Compose (권장)

```bash
# 1. 저장소 클론
git clone <repository-url>
cd gitlab-bulk-manager

# 2. 실행
docker compose up -d

# 3. 상태 확인
docker compose ps
```

### 수동 설치

```bash
# Frontend
cd frontend
npm install
npm run build

# Backend
cd ../backend
npm install
npm start
```

## 🔧 환경 설정

### 필수 환경 변수

```bash
# .env 파일 생성
cat > .env << EOF
# Redis 설정
REDIS_PASSWORD=your_redis_password

# 세션 설정
SESSION_SECRET=your_session_secret

# GitLab 설정 (선택사항)
DEFAULT_GITLAB_URL=https://gitlab.com
EOF
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
# 개발 모드로 실행
docker compose -f docker-compose.dev.yml up

# 또는 관리 스크립트 사용
./manage.sh dev
```

### 테스트 실행

```bash
# Frontend 테스트
cd frontend && npm test

# Backend 테스트
cd backend && npm test

# E2E 테스트
npm run test:e2e
```

## 🔒 보안

- GitLab Personal Access Token은 서버 세션에만 저장
- 세션 데이터는 Redis에 암호화되어 저장
- HTTPS 사용 권장 (프로덕션)
- Rate Limiting 적용

## 📝 라이선스

MIT License

## 🤝 기여

기여를 환영합니다! 이슈나 PR을 제출해주세요.

## 🆘 지원

- 이슈: [GitLab Issues](https://gitlab.internal/devops/gitlab-bulk-manager/issues)
- 담당팀: DevOps Team
- 이메일: devops@company.com

## 🔄 버전 정보

- 현재 버전: 1.0.0
- 최종 업데이트: 2024-01-31

## ⚡ 관리 스크립트

```bash
# 시작
./manage.sh start

# 중지
./manage.sh stop

# 재시작
./manage.sh restart

# 상태 확인
./manage.sh status

# 로그 확인
./manage.sh logs

# 백업
./manage.sh backup

# 복구
./manage.sh restore <backup-file>
```

## 🎯 로드맵

- [ ] 다중 GitLab 인스턴스 지원
- [ ] 스케줄링 기능
- [ ] Webhook 통합
- [ ] 감사 로그
- [ ] 다국어 지원

---

**문제가 있나요?** [이슈를 등록](https://gitlab.internal/devops/gitlab-bulk-manager/issues/new)해주세요.