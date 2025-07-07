---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🛠️ 개발 가이드

## 개발 환경 설정

### 사전 요구사항
- Node.js 18+ (nvm 사용 권장)
- npm 또는 yarn
- Git
- VS Code (권장) 또는 선호하는 IDE

### VS Code 확장 프로그램
최상의 개발 경험을 위한 권장 확장 프로그램:
- ESLint
- Prettier - Code formatter
- TypeScript Vue Plugin (Volar)
- Material Icon Theme
- GitLens
- Error Lens

### 환경 설정

로컬 개발을 위한 `.env.local` 생성:
```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_ENABLE_DEVTOOLS=true
```

## 개발 워크플로우

### 1. 서버 시작
```bash
# manage.sh 스크립트 사용 (권장)
./manage.sh start

# 또는 수동으로 실행
# 터미널 1: 백엔드 API 시작
cd backend
npm run dev

# 터미널 2: 프론트엔드 개발 서버 시작
cd frontend
npm run dev
```

### 2. 변경사항 감시
개발 서버는 파일 변경을 자동으로 감지하고 재로드합니다:
- **백엔드**: nodemon이 TypeScript 변경사항 감시
- **프론트엔드**: Vite의 HMR(Hot Module Replacement) 활성화

### 3. 테스트 실행
```bash
# 프론트엔드 테스트
cd frontend
npm test           # 단일 실행
npm run test:watch # 감시 모드
npm run test:coverage # 커버리지 포함

# 백엔드 테스트
cd backend
npm test           # 단일 실행
npm run test:watch # 감시 모드
```

## 코드 스타일 가이드

### TypeScript 규칙
```typescript
// 인터페이스는 I 접두사 없이
interface User {
  id: number;
  name: string;
}

// 타입은 구체적으로
type Status = 'active' | 'inactive' | 'pending';

// 함수는 명확한 타입과 함께
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### React 컴포넌트
```typescript
// 함수형 컴포넌트 사용
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
```

### 파일 구조
```
src/
├── components/        # 재사용 가능한 컴포넌트
│   ├── common/       # 공통 UI 컴포넌트
│   ├── bulk/         # 대량 작업 컴포넌트
│   └── layout/       # 레이아웃 컴포넌트
├── pages/            # 페이지 컴포넌트
├── services/         # API 서비스
├── store/            # Redux 스토어
├── hooks/            # 커스텀 훅
├── utils/            # 유틸리티 함수
└── types/            # TypeScript 타입 정의
```

## Git 워크플로우

### 브랜치 전략
```bash
main            # 프로덕션 브랜치
├── develop     # 개발 브랜치
│   ├── feature/add-bulk-export
│   ├── feature/improve-search
│   └── bugfix/fix-permission-error
```

### 커밋 메시지 형식
```
<type>(<scope>): <subject>

<body>

<footer>
```

타입:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 스타일 변경
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드 과정 또는 보조 도구 변경

예시:
```
feat(bulk): CSV 내보내기 기능 추가

- 선택한 그룹/프로젝트를 CSV로 내보내기
- 커스텀 필드 선택 옵션 추가
- 진행 상황 표시기 포함

Closes #123
```

## 디버깅

### VS Code 디버깅 설정
`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "preLaunchTask": "tsc: build - backend",
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

### 브라우저 개발자 도구
- **React DevTools**: 컴포넌트 트리 및 props 검사
- **Redux DevTools**: 상태 변경 및 액션 추적
- **Network 탭**: API 호출 모니터링

## 성능 최적화

### 코드 분할
```typescript
// 라우트 기반 분할
const GroupsProjects = lazy(() => import('./pages/GroupsProjects'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));

// 컴포넌트에서 사용
<Suspense fallback={<LoadingSpinner />}>
  <GroupsProjects />
</Suspense>
```

### 메모이제이션
```typescript
// useMemo로 비용이 많이 드는 계산 캐시
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// useCallback으로 함수 참조 유지
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### 가상 스크롤링
```typescript
// 큰 목록에 react-window 사용
import { VariableSizeList } from 'react-window';

<VariableSizeList
  height={600}
  itemCount={items.length}
  itemSize={getItemSize}
  width="100%"
>
  {Row}
</VariableSizeList>
```

## 보안 모범 사례

### 환경 변수
- 민감한 데이터는 절대 커밋하지 않음
- `.env` 파일은 `.gitignore`에 포함
- 프로덕션과 개발 환경 변수 분리

### API 보안
```typescript
// XSS 방지
const sanitizedHtml = DOMPurify.sanitize(userInput);

// CSRF 토큰 사용
axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
```

## 문제 해결

### 일반적인 문제

#### 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -i:3000
lsof -i:4000

# 프로세스 종료
kill -9 <PID>
```

#### 종속성 문제
```bash
# node_modules 정리 및 재설치
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript 오류
```bash
# TypeScript 캐시 정리
rm -rf dist
npm run build
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [컴포넌트](./components.md) | [한국어 문서](./README.md) | [테스팅](./testing.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/development.md)**

</div>