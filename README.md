# GitLab Bulk Manager

GitLab 그룹과 프로젝트를 효율적으로 관리하는 웹 애플리케이션입니다.

## 🌟 주요 기능

- **YAML 기반 대량 작업**: 계층적 그룹/프로젝트 생성
- **시각적 계층 구조 빌더**: 드래그 앤 드롭으로 구조 설계
- **트리 뷰 탐색**: 그룹과 프로젝트를 한눈에 파악
- **시스템 상태 모니터링**: GitLab 인스턴스 상태 확인


## ⚡ 빠른 시작

```bash
# 1. 클론 및 설정
git clone <repository-url>
cd .

# 2. 자동 실행
./manage.sh start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

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

- 🐛 [이슈 리포트](https://github.com/your-org/gitlab-bulk-manager/issues)