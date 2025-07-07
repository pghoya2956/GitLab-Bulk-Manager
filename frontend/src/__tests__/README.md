# Frontend Test Infrastructure

## Overview
This directory contains the test infrastructure and test files for the GitLab Bulk Manager frontend application.

## Test Setup

### Configuration
- **Framework**: Jest with TypeScript support via ts-jest
- **Environment**: jsdom (browser-like environment)
- **Test Runner**: Jest 29.x
- **Coverage**: Configured with lcov and HTML reporters

### Key Files
- `setupTests.ts` - Global test setup (DOM mocks, test library configuration)
- `test-utils.tsx` - Custom render function with all providers
- `fileMock.js` - Mock for static assets (images, etc.)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Writing Tests

### Basic Test Structure
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Using Custom Render
For components that need Redux store, routing, or other providers:

```typescript
import { render } from '../__tests__/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should work with providers', () => {
    render(<MyComponent />);
    // Your assertions
  });
});
```

## Current Test Coverage

The test infrastructure is set up and working. Current coverage is low as most components haven't been tested yet. Priority areas for testing:

1. **Utility Functions** ✅ (format.ts, errorUtils.ts)
2. **Redux Slices** - State management logic
3. **Service Layer** - API client and WebSocket
4. **Components** - Especially complex ones like GitLabTree
5. **Pages** - Integration tests for main pages

## Known Issues

1. **import.meta.env** - Vite's environment variables are mocked in the Jest configuration
2. **ESM Modules** - Some dependencies (react-markdown, etc.) require special handling in transformIgnorePatterns
3. **Coverage Thresholds** - Currently set to 1% to allow incremental improvement

## Next Steps

1. Add tests for Redux slices (authSlice, gitlabSlice, etc.)
2. Create tests for service layer (gitlab.ts, websocket.ts)
3. Add component tests starting with simpler components
4. Increase coverage thresholds as more tests are added
5. Consider adding React Testing Library user event for interaction tests