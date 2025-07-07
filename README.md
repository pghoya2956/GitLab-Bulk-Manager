# GitLab Bulk Manager

[![CI](https://github.com/gitlab-bulk-manager/gitlab-bulk-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/gitlab-bulk-manager/gitlab-bulk-manager/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/gitlab-bulk-manager/gitlab-bulk-manager/actions/workflows/e2e.yml/badge.svg)](https://github.com/gitlab-bulk-manager/gitlab-bulk-manager/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://hub.docker.com/r/gitlab-bulk-manager/gitlab-bulk-manager)

A powerful web-based tool for managing GitLab resources in bulk. Streamline your GitLab workflow with batch operations, visual organization, and real-time collaboration features.

GitLab 그룹과 프로젝트를 효율적으로 관리하는 강력한 웹 기반 도구입니다.

## ✨ Features / 주요 기능

### 🚀 Bulk Operations / 대량 작업
- Create multiple groups and projects from YAML templates
- Batch update visibility, access levels, and protection rules  
- Mass transfer projects between groups
- Bulk delete with safety confirmations
- YAML 기반 계층적 그룹/프로젝트 생성
- 일괄 가시성, 접근 레벨, 보호 규칙 업데이트
- 그룹 간 프로젝트 대량 이동
- 안전 확인을 통한 대량 삭제

### 📊 Visual Organization / 시각적 구성
- Interactive tree view of your GitLab hierarchy
- Drag-and-drop interface for reorganizing resources
- Real-time permission visualization
- Smart filtering and search capabilities
- GitLab 계층 구조의 대화형 트리 뷰
- 드래그 앤 드롭으로 리소스 재구성
- 실시간 권한 시각화
- 스마트 필터링 및 검색 기능

### 🔒 Security & Performance / 보안 및 성능
- Session-based authentication (tokens never exposed to frontend)
- Real-time updates via WebSocket
- System health monitoring dashboard
- Comprehensive audit trails
- 세션 기반 인증 (토큰이 프론트엔드에 노출되지 않음)
- WebSocket을 통한 실시간 업데이트
- 시스템 상태 모니터링 대시보드
- 포괄적인 감사 추적


## 🚀 Quick Start / 빠른 시작

### Prerequisites / 필수 요구사항
- Node.js >= 18.0.0
- npm >= 9.0.0
- GitLab account with Personal Access Token (API scope required)
- GitLab 계정 및 Personal Access Token (API 권한 필요)

### Installation / 설치

```bash
# 1. Clone the repository / 저장소 복제
git clone https://github.com/gitlab-bulk-manager/gitlab-bulk-manager.git
cd gitlab-bulk-manager

# 2. Install dependencies / 의존성 설치
npm install

# 3. Configure environment / 환경 설정
cp backend/.env.example backend/.env
# Edit backend/.env with your settings / 설정 편집

# 4. Start the application / 애플리케이션 시작
./manage.sh start
```

Access the application at / 다음 주소로 접속:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## 🏗️ 기술 스택

**Frontend**: React 18, TypeScript, Material-UI, Redux Toolkit  
**Backend**: Node.js, Express, GitLab API Proxy  
**통신**: Backend 프록시 패턴 (CORS 회피)

## ✨ 상세 기능

### 📁 그룹/프로젝트 관리
- 트리 구조로 탐색 및 관리
- 대량 생성 (YAML/CSV)
- 멤버 권한 관리

### 🚀 대량 작업
- YAML 편집기 (템플릿 제공)
- 시각적 계층 빌더
- CSV 가져오기 (레거시)

### 📊 시스템 모니터링
- GitLab 인스턴스 상태
- API 사용량 추적
- 인증 상태 확인

## 📋 필수 요구사항

- Node.js 16+
- npm 7+
- GitLab Personal Access Token (api, read_api 권한)

## 🚀 설치 및 실행

### 자동 설정 (권장)
```bash
# 서버 시작
./manage.sh start

# 서버 중지
./manage.sh stop  

# 서버 재시작
./manage.sh restart

# 상태 확인
./manage.sh status

# 로그 보기
./manage.sh logs
```

### 수동 설정
```bash
# Backend 설정
cd backend
npm install
cp .env.example .env
# .env에 GitLab 토큰 설정

# Frontend 설정
cd ../frontend
npm install

# 실행
cd backend && npm run dev  # 터미널 1
cd frontend && npm run dev # 터미널 2
```

## 📄 YAML 형식 예제

### 서브그룹 생성
```yaml
parent_id: 123
subgroups:
  - name: Backend
    path: backend
    subgroups:
      - name: API
        path: api
```

### 프로젝트 생성
```yaml
parent_id: 123
projects:
  - name: Website
    path: website
    visibility: private
```

## 🧪 테스트

```bash
# 유닛 테스트
cd frontend && npm test

# E2E 테스트
npx playwright test
```



## 🤝 기여하기

[CONTRIBUTING.md](./CONTRIBUTING.md) 참조

## 🐛 문제 해결

### 401 인증 오류
- GitLab 토큰 권한 확인
- Backend 서버 실행 확인 (포트 4000)

### CORS 오류
- Frontend가 GitLab API를 직접 호출하는 경우 발생
- 모든 API 호출은 `/api/gitlab/*` 경로 사용


## 📄 라이선스

MIT License

## 🆘 지원

- 🐛 [이슈 리포트](https://github.com/gitlab-bulk-manager/gitlab-bulk-manager/issues)