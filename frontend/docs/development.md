# Development Guide

## Development Environment Setup

### Prerequisites
- Node.js 16+ (recommend using nvm)
- npm or yarn
- Git
- VS Code (recommended) or your preferred IDE

### VS Code Extensions
Recommended extensions for the best development experience:
- ESLint
- Prettier - Code formatter
- TypeScript Vue Plugin (Volar)
- Material Icon Theme
- GitLens
- Error Lens

### Environment Configuration

Create `.env.local` for local development:
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
VITE_ENABLE_DEVTOOLS=true
```

## Development Workflow

### 1. Start Backend Services
```bash
# Terminal 1: Start backend API
cd backend
npm run dev

# Terminal 2: Start bash scripts API (if needed)
cd Scripts
./start-api-server.sh
```

### 2. Start Frontend Dev Server
```bash
# Terminal 3: Start frontend
cd frontend
npm run dev
```

### 3. Run Tests in Watch Mode
```bash
# Terminal 4: Run tests
npm run test:watch
```

## Code Style Guide

### TypeScript Conventions

#### Interfaces vs Types
- Use `interface` for object shapes
- Use `type` for unions, intersections, and primitives

```typescript
// Good
interface User {
  id: number;
  name: string;
}

type Status = 'active' | 'inactive' | 'pending';

// Avoid
type User = {
  id: number;
  name: string;
};
```

#### Naming Conventions
- Components: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase
- Enums: PascalCase with UPPER_SNAKE_CASE values

```typescript
// Component
export const UserProfile: React.FC = () => { };

// Function
const calculateTotal = (items: Item[]) => { };

// Constant
const MAX_RETRY_COUNT = 3;

// Enum
enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}
```

### React Best Practices

#### Component Structure
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

// 2. Types
interface ComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

// 3. Component
export const Component: React.FC<ComponentProps> = ({ title, onSubmit }) => {
  // 4. State
  const [loading, setLoading] = useState(false);
  
  // 5. Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // 6. Handlers
  const handleSubmit = () => {
    // Handler logic
  };
  
  // 7. Render
  return (
    <Box>
      <Typography>{title}</Typography>
    </Box>
  );
};
```

#### Hooks Rules
- Always call hooks at the top level
- Only call hooks from React functions
- Use custom hooks for shared logic

```typescript
// Custom hook example
function useGitLabData(groupId: number) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    gitlabService.getGroup(groupId)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [groupId]);

  return { data, loading, error };
}
```

### State Management Guidelines

#### When to Use Local State
- Form inputs
- UI state (modals, toggles)
- Component-specific data

#### When to Use Redux
- Shared data across components
- User authentication
- Global UI state (theme, locale)
- Cached API data

#### Redux Patterns
```typescript
// Slice example
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
    },
  },
});
```

## Testing

### Unit Testing

#### Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserForm } from './UserForm';

describe('UserForm', () => {
  it('should submit form with correct data', () => {
    const onSubmit = jest.fn();
    render(<UserForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'John Doe' }
    });
    
    fireEvent.click(screen.getByText('Submit'));
    
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John Doe'
    });
  });
});
```

#### Service Testing
```typescript
import { gitlabService } from './gitlab';

jest.mock('axios');

describe('GitLabService', () => {
  it('should fetch groups', async () => {
    const mockGroups = [{ id: 1, name: 'Test' }];
    axios.get.mockResolvedValue({ data: mockGroups });
    
    const groups = await gitlabService.getGroups();
    
    expect(groups).toEqual(mockGroups);
  });
});
```

### Integration Testing

#### API Integration
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/groups', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: 'Test Group' }]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### E2E Testing

See [testing.md](./testing.md) for detailed E2E testing guide.

## Performance Optimization

### Code Splitting
```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Memoization
```typescript
// Memoize expensive calculations
const expensiveValue = useMemo(
  () => computeExpensiveValue(a, b),
  [a, b]
);

// Memoize callbacks
const handleClick = useCallback(
  () => doSomething(id),
  [id]
);

// Memoize components
export default memo(Component);
```

### Virtual Scrolling
For large lists, implement virtual scrolling:
```typescript
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

## Debugging

### React DevTools
- Install React Developer Tools extension
- Use Profiler to identify performance issues
- Inspect component props and state

### Redux DevTools
- Install Redux DevTools extension
- Time-travel debugging
- Action history and state inspection

### Network Debugging
```typescript
// Log all API requests in development
if (import.meta.env.DEV) {
  client.interceptors.request.use((config) => {
    console.log('API Request:', config.method, config.url);
    return config;
  });
}
```

### Error Tracking
```typescript
// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Send to error tracking service
});

// React error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('React error:', error, errorInfo);
    // Send to error tracking service
  }
}
```

## Build and Deployment

### Development Build
```bash
npm run build
```

### Production Build
```bash
npm run build:prod
```

### Build Analysis
```bash
npm run build:analyze
```

### Environment-specific Builds
```bash
# Staging
VITE_ENV=staging npm run build

# Production
VITE_ENV=production npm run build
```

## Git Workflow

### Branch Naming
- Feature: `feature/add-user-management`
- Bug fix: `fix/login-error`
- Hotfix: `hotfix/critical-security-issue`
- Refactor: `refactor/improve-api-service`

### Commit Messages
Follow conventional commits:
```
feat: add bulk import for projects
fix: resolve authentication error on token expiry
docs: update API documentation
style: format code with prettier
refactor: simplify group service logic
test: add unit tests for user form
chore: update dependencies
```

### Pull Request Process
1. Create feature branch
2. Make changes and commit
3. Push branch and create PR
4. Ensure CI passes
5. Request code review
6. Address feedback
7. Merge when approved

## Troubleshooting

### Common Issues

#### Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript errors
```bash
# Check TypeScript compilation
npm run type-check

# Generate missing types
npm run generate-types
```

#### Build failures
```bash
# Clean build cache
rm -rf dist .vite
npm run build
```

### Performance Issues

#### Slow development server
- Check for circular dependencies
- Exclude large folders from Vite
- Update to latest Vite version

#### Memory leaks
- Check for missing effect cleanups
- Remove event listeners
- Cancel API requests on unmount