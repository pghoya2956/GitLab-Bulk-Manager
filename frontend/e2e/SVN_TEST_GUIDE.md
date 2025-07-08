# SVN to GitLab Migration E2E Test Guide

## 🚀 Quick Start

### 1. 환경 설정
```bash
cd frontend/e2e
cp .env.test .env.local
# .env.local 파일을 편집하여 GITLAB_PAT 값 설정
```

### 2. SVN 테스트 저장소 생성 (이미 완료됨)
```bash
cd ../../sample
./svn-setup.sh
```

### 3. 테스트 실행

#### 모든 SVN 테스트 실행:
```bash
cd frontend/e2e
./run-svn-tests.sh
```

#### 특정 테스트만 실행:
```bash
npx playwright test tests/12-svn-migration.spec.ts --headed
```

#### 디버그 모드로 실행:
```bash
DEBUG=1 ./run-svn-tests.sh
```

## 📋 테스트 시나리오

### 1. 기본 마이그레이션 테스트
- SVN 연결 테스트
- 사용자 매핑 설정
- 프로젝트 미리보기
- 마이그레이션 실행
- 진행 상황 모니터링

### 2. 다양한 레이아웃 테스트
- **Standard Layout**: trunk/branches/tags
- **Trunk Only**: 브랜치 없는 단순 구조
- **Custom Layout**: Stable/Development 분리

### 3. 대량 마이그레이션
- YAML 파일 업로드
- CSV 파일 업로드
- 여러 프로젝트 동시 마이그레이션

### 4. 증분 동기화
- 기존 마이그레이션 프로젝트 선택
- 새로운 커밋만 동기화

### 5. 오류 처리
- 잘못된 SVN URL
- 권한 없는 접근
- 네트워크 오류

## 🔍 테스트 데이터

### SVN 저장소 URL
```
file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/standard-layout
file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/trunk-only
file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/stable-dev
file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/multi-project
file:///Users/infograb/Workspace/Area/GitLab/sample/svn-repos/release-branches
```

### 테스트 파일
- Authors 매핑: `/sample/authors.txt`
- YAML 설정: `/sample/bulk-migration.yaml`
- CSV 설정: `/sample/bulk-migration.csv`

## 🛠️ 디버깅

### 로그 확인
```bash
# Frontend 로그
tail -f ../../logs/frontend.log

# Backend 로그
tail -f ../../logs/backend.log
```

### 스크린샷
실패한 테스트의 스크린샷은 다음 위치에 저장됩니다:
```
frontend/e2e/test-results/screenshots/
```

### WebSocket 디버깅
Chrome DevTools > Network > WS 탭에서 실시간 메시지 확인

## ⚠️ 주의사항

1. **PAT 보안**: 절대로 실제 PAT를 코드에 하드코딩하지 마세요
2. **로컬 경로**: 테스트는 로컬 SVN 저장소를 사용합니다
3. **권한**: SVN 명령어 실행 권한이 필요합니다
4. **정리**: 테스트 후 생성된 GitLab 프로젝트는 수동으로 삭제해야 합니다

## 📊 예상 결과

성공적인 테스트 실행 시:
- ✅ 12개의 테스트 시나리오 통과
- ✅ WebSocket을 통한 실시간 진행 상황 확인
- ✅ 다양한 SVN 레이아웃 지원 확인
- ✅ 대량 마이그레이션 기능 검증
- ✅ 오류 처리 및 복구 확인

## 🐛 문제 해결

### "SVN 명령어를 찾을 수 없음"
```bash
brew install subversion
```

### "파일을 찾을 수 없음"
절대 경로가 올바른지 확인:
```bash
ls -la /Users/infograb/Workspace/Area/GitLab/sample/svn-repos/
```

### "권한 거부됨"
```bash
chmod +x run-svn-tests.sh
```

### "WebSocket 연결 실패"
백엔드 서버가 실행 중인지 확인:
```bash
cd ../..
./manage.sh status
```