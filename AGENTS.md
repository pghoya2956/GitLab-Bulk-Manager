# Repository Guidelines

컨트리뷰터는 GitLab 대량 관리 도구를 다루며, React/Vite 프런트엔드와 Express/TypeScript 백엔드를 중심으로 협업합니다. 아래 지침을 따라 최소한의 자원으로 개발 환경을 유지하세요.

## Project Structure & Module Organization
- `backend/`에는 API 게이트웨이 (`src/api`, `services`, `domain`)와 테스트가 `src/__tests__`에 위치합니다.
- `frontend/`는 Vite 기반 React 앱으로, 주요 뷰는 `src/pages`, UI는 `components`, 상태는 `store`에 모여 있으며 단위 테스트는 `src/**/__tests__`에 있습니다.
- 인프라 구성은 `docker-compose*.yml`에 정리되어 있으며, 추가 산출물 폴더는 생성 시 즉시 삭제합니다.

## Build, Test, and Development Commands
- `docker compose up -d`: 백엔드/프런트엔드/Redis를 동시에 올리는 기본 개발 방법입니다.
- `cd backend && npm run dev`: nodemon 기반 API 개발 서버; `npm run build`는 배포용 `dist/`를 생성합니다.
- `cd frontend && npm run dev`: Vite 개발 서버; `npm run build`는 최적화 번들을, `npm run preview`는 번들 검증용 서버를 실행합니다.

## Coding Style & Naming Conventions
- 전 영역 TypeScript 사용, 공통 들여쓰기는 스페이스 2칸, ES Module import를 유지합니다.
- 린트는 각 패키지에서 `npm run lint`로 실행합니다. 프런트엔드는 `npm run format`으로 Prettier 정렬을 수행합니다.
- React 컴포넌트는 PascalCase, hooks/유틸은 camelCase, 파일명은 기능을 반영한 kebab-case를 권장합니다.

## Testing Guidelines
- 백엔드: Jest + Supertest (`npm run test`, `npm run test:coverage`), 테스트는 `src/__tests__`에 `*.test.ts` 패턴으로 둡니다.
- 프런트엔드: Jest + Testing Library (`npm run test`, `npm run test:watch`)와 Playwright E2E (`npm run test:e2e`).
- Redux 로직은 slice 단위로, UI는 상호작용 케이스 중심으로 커버하고, 비결정적 테스트는 주석으로 이유를 남깁니다.

## Commit & Pull Request Guidelines
- 커밋 메시지는 짧은 명령형 주어를 사용하고, 필요 시 `GitLab Bulk Manager: ...`와 같은 스코프 프리픽스를 추가합니다.
- WIP 커밋은 로컬에서 스쿼시하고, 관련 이슈는 `#123` 형태로 연결합니다. 도커/환경에 영향이 있으면 본문에 명시합니다.
- PR은 UI 변경 사항 요약, 영향 받은 API 리스트, 필요 시 스크린샷 또는 로그 스니펫을 포함하세요.

## Security & Configuration Tips
- `.env`는 버전에 포함하지 말고 각 패키지의 `.env.example`에서 복사해 사용하세요. 필수 키는 `SESSION_SECRET`, `REDIS_URL`, `VITE_API_URL`, `VITE_WS_URL`입니다.
- Docker 실행과 로컬 실행을 동시에 두지 말고, 전환 시 `docker compose down`으로 세션 스토리지를 정리하세요.
