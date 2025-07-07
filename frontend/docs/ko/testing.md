---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🧪 테스팅 가이드

## 테스트 전략

### 테스트 피라미드
```
         E2E 테스트
        /         \
       통합 테스트
      /           \
     단위 테스트
```

- **단위 테스트**: 개별 함수와 컴포넌트
- **통합 테스트**: 컴포넌트 간 상호작용
- **E2E 테스트**: 전체 사용자 플로우

## 프론트엔드 테스팅

### 테스트 환경 설정
```bash
# 필요한 패키지 설치
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event jest-environment-jsdom
```

### 컴포넌트 테스트
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button 컴포넌트', () => {
  it('클릭 이벤트를 처리해야 함', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>클릭</Button>);
    
    const button = screen.getByText('클릭');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('비활성화 상태를 렌더링해야 함', () => {
    render(<Button disabled>비활성화</Button>);
    
    const button = screen.getByText('비활성화');
    expect(button).toBeDisabled();
  });
});
```

### 훅 테스트
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useCounter } from './useCounter';

describe('useCounter 훅', () => {
  it('카운터를 증가시켜야 함', () => {
    const { result } = renderHook(() => useCounter());
    
    expect(result.current.count).toBe(0);
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

### Redux 스토어 테스트
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './authSlice';

describe('Auth Slice', () => {
  it('로그인 액션을 처리해야 함', () => {
    const store = configureStore({
      reducer: { auth: authSlice.reducer }
    });
    
    store.dispatch(authSlice.actions.login({
      user: { id: 1, name: 'Test User' },
      token: 'test-token'
    }));
    
    const state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user?.name).toBe('Test User');
  });
});
```

## 백엔드 테스팅

### API 엔드포인트 테스트
```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/groups', () => {
  it('그룹 목록을 반환해야 함', async () => {
    const response = await request(app)
      .get('/api/groups')
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    
    expect(response.body).toHaveProperty('groups');
    expect(Array.isArray(response.body.groups)).toBe(true);
  });
  
  it('인증 없이 401을 반환해야 함', async () => {
    await request(app)
      .get('/api/groups')
      .expect(401);
  });
});
```

### 서비스 레이어 테스트
```typescript
import { GitLabService } from '../src/services/gitlab';
import axios from 'axios';

jest.mock('axios');

describe('GitLabService', () => {
  let service: GitLabService;
  
  beforeEach(() => {
    service = new GitLabService('test-token');
  });
  
  it('그룹을 생성해야 함', async () => {
    const mockGroup = { id: 1, name: 'Test Group' };
    (axios.post as jest.Mock).mockResolvedValue({ data: mockGroup });
    
    const result = await service.createGroup({
      name: 'Test Group',
      path: 'test-group'
    });
    
    expect(result).toEqual(mockGroup);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/groups'),
      expect.any(Object)
    );
  });
});
```

## E2E 테스팅

### Playwright 설정
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

### E2E 테스트 예시
```typescript
import { test, expect } from '@playwright/test';

test.describe('로그인 플로우', () => {
  test('유효한 자격 증명으로 로그인', async ({ page }) => {
    await page.goto('/login');
    
    // 폼 입력
    await page.fill('input[name="gitlabUrl"]', 'https://gitlab.com');
    await page.fill('input[name="token"]', 'test-token');
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');
    
    // 대시보드로 리다이렉트 확인
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('대시보드');
  });
  
  test('잘못된 토큰으로 오류 표시', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="gitlabUrl"]', 'https://gitlab.com');
    await page.fill('input[name="token"]', 'invalid-token');
    await page.click('button[type="submit"]');
    
    // 오류 메시지 확인
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('인증 실패');
  });
});
```

## 테스트 모범 사례

### 1. AAA 패턴
```typescript
test('사용자 생성 테스트', () => {
  // Arrange (준비)
  const userData = { name: 'John', email: 'john@example.com' };
  
  // Act (실행)
  const user = createUser(userData);
  
  // Assert (검증)
  expect(user.name).toBe('John');
  expect(user.email).toBe('john@example.com');
});
```

### 2. 테스트 격리
```typescript
describe('UserService', () => {
  let service: UserService;
  let mockDb: MockDatabase;
  
  beforeEach(() => {
    // 각 테스트 전에 새로운 인스턴스 생성
    mockDb = new MockDatabase();
    service = new UserService(mockDb);
  });
  
  afterEach(() => {
    // 정리 작업
    mockDb.reset();
  });
  
  // 테스트들...
});
```

### 3. 의미 있는 테스트 이름
```typescript
// 나쁜 예
test('test user', () => {});

// 좋은 예
test('새 사용자 생성 시 환영 이메일을 전송해야 함', () => {});
test('중복된 이메일로 사용자 생성 시 오류를 발생시켜야 함', () => {});
```

## 테스트 커버리지

### 커버리지 목표
- 전체 커버리지: 80% 이상
- 핵심 비즈니스 로직: 90% 이상
- 유틸리티 함수: 100%

### 커버리지 실행
```bash
# 프론트엔드 커버리지
npm run test:coverage

# 백엔드 커버리지
npm run test:coverage

# 커버리지 리포트 보기
open coverage/index.html
```

### 커버리지 구성
```json
// jest.config.js
{
  "collectCoverageFrom": [
    "src/**/*.{js,ts,tsx}",
    "!src/index.tsx",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

## 지속적 통합 (CI)

### GitHub Actions 워크플로우
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci --prefix backend
        npm ci --prefix frontend
    
    - name: Run backend tests
      run: npm test --prefix backend
    
    - name: Run frontend tests
      run: npm test --prefix frontend
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## 테스트 디버깅

### 단일 테스트 실행
```bash
# 특정 테스트 파일만 실행
npm test Button.test.tsx

# 특정 테스트만 실행
npm test -- -t "클릭 이벤트를 처리해야 함"
```

### 디버그 모드
```bash
# VS Code 디버거 연결
node --inspect-brk node_modules/.bin/jest --runInBand

# 콘솔 로그 표시
npm test -- --verbose
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [개발](./development.md) | [한국어 문서](./README.md) | [배포](./deployment.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/testing.md)**

</div>