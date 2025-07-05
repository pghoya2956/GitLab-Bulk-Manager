# Testing Guide

## Testing Overview

The GitLab Bulk Manager uses a comprehensive testing strategy:
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: MSW for API mocking
- **E2E Tests**: Playwright for end-to-end testing

## Unit Testing

### Setup

Tests are configured in `jest.config.js` and use:
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM assertions
- `jest` for test runner and assertions

### Writing Component Tests

#### Basic Component Test
```typescript
import { render, screen } from '@testing-library/react';
import { GroupCard } from './GroupCard';

describe('GroupCard', () => {
  const mockGroup = {
    id: 1,
    name: 'Test Group',
    full_path: 'root/test-group',
    visibility: 'private'
  };

  it('renders group information', () => {
    render(<GroupCard group={mockGroup} />);
    
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByText('root/test-group')).toBeInTheDocument();
    expect(screen.getByText('private')).toBeInTheDocument();
  });
});
```

#### Testing User Interactions
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateGroupForm } from './CreateGroupForm';

describe('CreateGroupForm', () => {
  it('submits form with entered data', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<CreateGroupForm onSubmit={onSubmit} />);
    
    // Type in form fields
    await user.type(screen.getByLabelText('Group Name'), 'New Group');
    await user.type(screen.getByLabelText('Description'), 'Test description');
    await user.selectOptions(screen.getByLabelText('Visibility'), 'private');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: 'Create Group' }));
    
    // Verify submission
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'New Group',
        description: 'Test description',
        visibility: 'private'
      });
    });
  });
});
```

#### Testing with Redux
```typescript
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Dashboard } from './Dashboard';
import { authSlice } from '../store/authSlice';

const renderWithRedux = (component, { initialState } = {}) => {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer
    },
    preloadedState: initialState
  });
  
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('Dashboard', () => {
  it('displays user name when authenticated', () => {
    renderWithRedux(<Dashboard />, {
      initialState: {
        auth: {
          isAuthenticated: true,
          user: { name: 'John Doe' }
        }
      }
    });
    
    expect(screen.getByText('Welcome, John Doe')).toBeInTheDocument();
  });
});
```

### Testing Services

#### API Service Tests
```typescript
import axios from 'axios';
import { gitlabService } from './gitlab';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitLabService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGroups', () => {
    it('fetches groups successfully', async () => {
      const mockGroups = [
        { id: 1, name: 'Group 1' },
        { id: 2, name: 'Group 2' }
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: mockGroups });
      
      const result = await gitlabService.getGroups();
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/groups', {
        params: undefined
      });
      expect(result).toEqual(mockGroups);
    });

    it('handles errors properly', async () => {
      const errorMessage = 'Network Error';
      mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(gitlabService.getGroups()).rejects.toThrow(errorMessage);
    });
  });
});
```

### Testing Hooks

#### Custom Hook Tests
```typescript
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  jest.useFakeTimers();

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });
    
    // Value shouldn't change immediately
    expect(result.current).toBe('initial');
    
    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    // Now value should be updated
    expect(result.current).toBe('updated');
  });
});
```

## Integration Testing

### API Mocking with MSW

#### Setup MSW
```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/groups', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'Test Group 1' },
        { id: 2, name: 'Test Group 2' }
      ])
    );
  }),
  
  rest.post('/api/groups', async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        id: 3,
        ...body
      })
    );
  })
];
```

#### Integration Test Example
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupList } from './GroupList';
import { server } from '../mocks/server';

// Start server before all tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GroupList Integration', () => {
  it('loads and displays groups from API', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    
    render(
      <QueryClientProvider client={queryClient}>
        <GroupList />
      </QueryClientProvider>
    );
    
    // Wait for groups to load
    await waitFor(() => {
      expect(screen.getByText('Test Group 1')).toBeInTheDocument();
      expect(screen.getByText('Test Group 2')).toBeInTheDocument();
    });
  });
});
```

## E2E Testing with Playwright

### Setup

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

### Configuration
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### E2E Test Examples

#### Login Flow
```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can login successfully', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[name="gitlabUrl"]', 'https://gitlab.example.com');
    await page.fill('[name="token"]', 'test-token-123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h4')).toContainText('GitLab Dashboard');
  });
});
```

#### Bulk Operations Test
```typescript
test.describe('Bulk Operations', () => {
  test('import groups from CSV', async ({ page }) => {
    // Navigate to bulk operations
    await page.goto('/bulk-operations');
    
    // Select target group
    await page.click('text=Resource');
    await expect(page.locator('[role="alert"]')).toContainText('resource8901806');
    
    // Upload CSV file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-data/groups.csv');
    
    // Start import
    await page.click('text=Start Import');
    
    // Wait for completion
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    
    // Verify success
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

#### Tree View Interaction
```typescript
test.describe('Project Management', () => {
  test('navigate tree and select items', async ({ page }) => {
    await page.goto('/projects');
    
    // Expand group
    await page.click('[aria-label="Expand Resource"]');
    
    // Wait for children to load
    await expect(page.locator('text=Subgroup 1')).toBeVisible();
    
    // Select a project
    await page.click('text=Project Alpha');
    
    // Verify details panel
    await expect(page.locator('h4')).toContainText('Project Alpha');
    await expect(page.locator('text=Type: Project')).toBeVisible();
  });

  test('drag and drop functionality', async ({ page }) => {
    await page.goto('/projects');
    
    // Perform drag and drop
    const source = page.locator('text=Project Alpha');
    const target = page.locator('text=Another Group');
    
    await source.dragTo(target);
    
    // Verify move confirmation dialog
    await expect(page.locator('[role="dialog"]')).toContainText(
      'Move Project Alpha to Another Group?'
    );
    
    await page.click('text=Confirm');
    
    // Verify success message
    await expect(page.locator('[role="alert"]')).toContainText(
      'Successfully moved'
    );
  });
});
```

### Page Object Model

#### Define Page Objects
```typescript
// e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(url: string, token: string) {
    await this.page.fill('[name="gitlabUrl"]', url);
    await this.page.fill('[name="token"]', token);
    await this.page.click('button[type="submit"]');
  }
}

// e2e/pages/BulkOperationsPage.ts
export class BulkOperationsPage {
  constructor(private page: Page) {}

  async selectGroup(groupName: string) {
    await this.page.click(`text=${groupName}`);
  }

  async uploadFile(filePath: string) {
    const fileInput = await this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  async startImport() {
    await this.page.click('text=Start Import');
  }

  async waitForCompletion() {
    await this.page.waitForSelector('[role="progressbar"][aria-valuenow="100"]');
  }
}
```

#### Use Page Objects in Tests
```typescript
import { LoginPage } from './pages/LoginPage';
import { BulkOperationsPage } from './pages/BulkOperationsPage';

test('complete bulk import workflow', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const bulkOpsPage = new BulkOperationsPage(page);

  // Login
  await loginPage.goto();
  await loginPage.login('https://gitlab.example.com', 'token');

  // Perform bulk import
  await page.goto('/bulk-operations');
  await bulkOpsPage.selectGroup('Target Group');
  await bulkOpsPage.uploadFile('./test-data/import.csv');
  await bulkOpsPage.startImport();
  await bulkOpsPage.waitForCompletion();

  // Verify results
  await expect(page.locator('text=Import completed')).toBeVisible();
});
```

## Test Data Management

### Fixtures
```typescript
// fixtures/groups.ts
export const mockGroups = [
  {
    id: 1,
    name: 'Frontend Team',
    full_path: 'company/frontend',
    visibility: 'private',
    description: 'Frontend development team'
  },
  {
    id: 2,
    name: 'Backend Team',
    full_path: 'company/backend',
    visibility: 'internal',
    description: 'Backend development team'
  }
];

// Use in tests
import { mockGroups } from '../fixtures/groups';
```

### Test Database
For integration tests, use a test database:
```typescript
// test-utils/db.ts
export async function seedTestData() {
  // Seed test groups
  await Promise.all(
    mockGroups.map(group => 
      gitlabService.createGroup(group)
    )
  );
}

export async function cleanupTestData() {
  // Clean up after tests
  await gitlabService.deleteAllGroups();
}
```

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Run specific test file
npm test -- GroupCard.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should render"
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run E2E tests
        run: |
          npm run build
          npm run preview &
          npx playwright install
          npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Best Practices

### Test Organization
- Group related tests with `describe` blocks
- Use clear, descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused and isolated

### Mocking
- Mock external dependencies
- Use MSW for API mocking
- Avoid mocking React components
- Reset mocks between tests

### Assertions
- Use specific assertions
- Test behavior, not implementation
- Verify accessibility attributes
- Check error states

### Performance
- Use `waitFor` for async operations
- Avoid arbitrary delays
- Clean up after tests
- Use test utilities for common operations