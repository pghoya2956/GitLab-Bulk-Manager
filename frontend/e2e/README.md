# GitLab Bulk Manager - E2E Test Suite

## Overview

This comprehensive E2E test suite validates all features of the GitLab Bulk Manager application using Playwright. The tests are designed to run against GitLab group ID `107423238` as specified.

## Test Coverage

### 1. Environment Verification (`01-environment.spec.ts`)
- Validates GitLab API connectivity
- Verifies access to target group 107423238
- Checks application configuration

### 2. Authentication (`02-authentication.spec.ts`)
- Login flow for all user roles (admin, manager, developer, viewer)
- Session management
- Logout functionality
- Performance metrics for authentication

### 3. Permissions System (`03-permissions.spec.ts`)
- Role-Based Access Control (RBAC) validation
- UI element visibility based on roles
- API-level permission enforcement
- Cross-role security verification

### 4. Group Management (`04-group-management.spec.ts`)
- CRUD operations on groups
- Virtual scrolling with large datasets
- Drag-and-drop functionality
- Search and filter capabilities
- Bulk selection operations

### 5. Project Management (`05-project-management.spec.ts`)
- Tree view navigation
- Lazy loading performance
- Project CRUD operations
- Drag-and-drop between groups
- Context menu actions

### 6. Bulk Operations (`06-bulk-operations.spec.ts`)
- Mass creation of groups/projects
- File upload and validation
- Parallel execution
- Error handling and recovery
- Operation history tracking

### 7. Backup & Restore (`07-backup-restore.spec.ts`)
- Full and partial backups
- Encrypted backup support
- Restore operations
- Scheduled backups
- Backup integrity verification

### 8. Real-time Notifications (`08-realtime-notifications.spec.ts`)
- WebSocket connection testing
- Notification delivery latency
- Notification management (read/delete)
- Settings configuration
- Performance under load

### 9. Monitoring Dashboard (`09-monitoring-dashboard.spec.ts`)
- System health monitoring
- API metrics tracking
- Resource usage visualization
- Alert management
- Data export functionality

### 10. Performance & Load Testing (`10-performance-load.spec.ts`)
- Page load performance
- Large dataset handling
- Concurrent user simulation
- Memory leak detection
- API response time benchmarks

### 11. Security Scanning (`11-security-scan.spec.ts`)
- Authentication security
- XSS protection validation
- SQL injection testing
- CSRF protection
- Authorization bypass attempts
- Input validation
- Security headers verification

## Prerequisites

1. Node.js 16+ and npm
2. GitLab instance with API access
3. Valid test user accounts for each role
4. Target group ID 107423238 with appropriate permissions

## Installation

```bash
# Install dependencies
cd frontend
npm install

# Install Playwright browsers
npx playwright install
```

## Configuration

1. Copy the test configuration template:
```bash
cp e2e/config/test.config.example.ts e2e/config/test.config.ts
```

2. Update `test.config.ts` with your environment details:
```typescript
export const TEST_CONFIG = {
  APP_URL: 'http://localhost:3000',
  GITLAB_URL: 'https://gitlab.example.com',
  GITLAB_TOKEN: 'your-api-token',
  TARGET_GROUP_ID: 107423238,
  TEST_USERS: {
    admin: { username: 'admin@example.com', password: 'password' },
    // ... other users
  }
};
```

## Running Tests

### Run All Tests
```bash
./e2e/run-all-tests.sh
```

### Run Specific Test Suite
```bash
npx playwright test e2e/tests/04-group-management.spec.ts
```

### Run with UI Mode
```bash
npx playwright test --ui
```

### Run in Debug Mode
```bash
npx playwright test --debug
```

### Run with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Reports

After running tests, reports are available in:
- HTML Report: `test-results/e2e-test-report-{timestamp}.html`
- Screenshots: `test-results/screenshots/`
- Playwright Report: Run `npx playwright show-report`

## Page Object Model

The test suite uses Page Object Model pattern for better maintainability:

```typescript
// Example usage
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(username, password);
```

Available page objects:
- `LoginPage`: Authentication flows
- `DashboardPage`: Main dashboard interactions
- `GroupManagementPage`: Group CRUD operations
- `ProjectManagementPage`: Project tree and operations
- `BulkOperationsPage`: Bulk action handling
- `BackupRestorePage`: Backup/restore functionality
- `NotificationsPage`: Notification management
- `MonitoringPage`: System monitoring

## Writing New Tests

1. Create a new spec file in `e2e/tests/`
2. Import required page objects
3. Use the established patterns:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Feature Name', () => {
  let loginPage: LoginPage;
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
  });
  
  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

## Best Practices

1. **Cleanup**: Always clean up test data in `afterEach` or `afterAll` hooks
2. **Timestamps**: Use timestamps in test data names to avoid conflicts
3. **Assertions**: Use specific assertions rather than generic checks
4. **Screenshots**: Capture screenshots for important states
5. **Performance**: Measure and assert performance metrics
6. **Error Handling**: Test both success and failure scenarios

## Troubleshooting

### Test Timeouts
Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60000, // 60 seconds
```

### Flaky Tests
- Add explicit waits: `await page.waitForSelector()`
- Use `waitForLoadState('networkidle')`
- Check for race conditions

### Authentication Issues
- Verify test user credentials
- Check token expiration
- Ensure proper role assignments

### Performance Issues
- Run tests in headless mode
- Use parallel execution carefully
- Monitor system resources

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## Maintenance

1. **Update Dependencies**: Regularly update Playwright and other dependencies
2. **Review Selectors**: Ensure selectors remain valid after UI changes
3. **Update Test Data**: Refresh test data and user accounts periodically
4. **Monitor Performance**: Track test execution time trends
5. **Security**: Rotate test credentials regularly

## Support

For issues or questions:
1. Check test logs in `test-results/`
2. Review screenshots for visual debugging
3. Enable debug mode for detailed execution
4. Consult Playwright documentation: https://playwright.dev