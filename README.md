# GitLab Bulk Manager

GitLab 그룹과 프로젝트를 대량으로 관리할 수 있는 웹 애플리케이션입니다.

## 주요 기능

### 1. GitLab 리소스 관리
- 그룹/프로젝트 트리 뷰로 시각화
- 대량 생성/삭제/설정 변경
- 권한 관리 및 멤버 조회
- YAML 파일로 대량 가져오기

### 2. 시스템 모니터링
- 실시간 시스템 상태 확인
- WebSocket 연결 상태
- 활성 작업 모니터링

## 시스템 요구사항

- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Git
- Docker & Docker Compose (선택사항)

## 빠른 시작

### 1. 저장소 클론
```bash
git clone https://github.com/your-repo/gitlab-bulk-manager.git
cd gitlab-bulk-manager
```

### 2. 환경 설정

#### Backend 설정 (.env)
```bash
cd backend
cp .env.example .env
```

`.env` 파일 수정:
```env
PORT=4000
SESSION_SECRET=your-secret-key-here
FRONTEND_URL=http://localhost:3030
```



### 3. 의존성 설치 및 실행

#### 방법 1: 관리 스크립트 사용 (권장)
```bash
# 프로젝트 루트에서
npm install

# 일반 실행
./manage.sh start

# 터미널에서 색상 코드가 깨지는 경우
./manage-simple.sh start
```

이 명령어는 자동으로:
- Backend (포트 4040)
- Frontend (포트 3030) 
를 모두 시작합니다.

#### 방법 2: 개별 실행
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (새 터미널)
cd frontend
npm install
npm run dev

```

#### 방법 3: Docker Compose 사용
```bash
docker-compose up
```

### 4. 접속
브라우저에서 http://localhost:3030 접속

### 5. 로그인
1. GitLab 인스턴스 URL 입력 (예: https://gitlab.com)
2. Personal Access Token 입력 (필요한 권한: `api`, `read_user`)

## 서비스 관리

### 서비스 상태 확인
```bash
./manage.sh status
# 또는
./manage-simple.sh status
```

### 서비스 중지
```bash
./manage.sh stop
# 또는
./manage-simple.sh stop
```

### 서비스 재시작
```bash
./manage.sh restart
# 또는
./manage-simple.sh restart
```

### 로그 확인
```bash
./manage.sh logs
# 또는
./manage-simple.sh logs
```

## 주요 기능 사용법

### GitLab 리소스 관리
1. **Groups & Projects** 탭 클릭
2. 트리 뷰에서 그룹/프로젝트 탐색
3. 우클릭 또는 버튼으로 대량 작업 수행


### 시스템 상태 확인
1. **System Health** 탭 클릭
2. 실시간 모니터링 정보 확인

## 프로젝트 구조

```
gitlab-bulk-manager/
├── backend/               # Express.js 백엔드 서버
│   ├── src/
│   │   ├── routes/       # API 라우트
│   │   ├── middleware/   # 미들웨어
│   │   └── services/     # 비즈니스 로직
│   └── package.json
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── components/   # 재사용 컴포넌트
│   │   └── services/     # API 클라이언트
│   └── package.json
├── docker-compose.yml     # Docker 설정
├── manage.sh             # 서비스 관리 스크립트
├── manage-simple.sh      # 서비스 관리 스크립트 (색상 없음)
└── README.md             # 이 파일
```

## API 엔드포인트

### Backend (포트 4000)
- `/api/auth/*` - 인증 관련
- `/api/gitlab/*` - GitLab API 프록시
- `/api/gitlab/bulk/*` - 대량 작업
- `/api/permissions/overview` - 권한 개요
- `/api/stats/*` - 통계


## 문제 해결

### 터미널 색상 코드 문제
터미널에서 `[0;34m` 같은 코드가 보이는 경우:
```bash
# manage-simple.sh 사용
./manage-simple.sh start
```

### 포트 충돌
포트가 이미 사용 중인 경우:
```bash
# 사용 중인 프로세스 확인
lsof -i:3000
lsof -i:4000
lsof -i:5001

# 프로세스 종료
kill -9 <PID>
```

### 로그인 문제
- GitLab Personal Access Token에 `api`, `read_user` 권한이 있는지 확인
- GitLab URL이 올바른지 확인 (https:// 포함)


## 기여하기

1. Fork 저장소
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 커밋 (`git commit -m 'Add some amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

## 지원

문제가 발생하거나 기능 요청이 있으시면 [Issues](https://github.com/your-repo/gitlab-bulk-manager/issues)에 등록해주세요.