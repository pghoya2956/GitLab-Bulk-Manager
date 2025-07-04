# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the GitLab Bulk Manager project.

## Project Overview

GitLab Bulk Manager is a full-stack web application for managing GitLab groups and projects in bulk. It consists of:
- **Frontend**: React 18 + TypeScript SPA with Material-UI (port 3000)
- **Backend**: Node.js/Express proxy server handling GitLab API communication (port 4000)
- **Architecture**: Backend proxy pattern to avoid CORS, session-based auth with httpOnly cookies
- **Target Group**: Default testing with GitLab group ID 107423238

## Essential Context

### Servers Must Be Running
This project requires BOTH servers to be running:
```bash
# Quick start both servers
./start.sh

# Or run separately:
cd backend && npm run dev   # Port 4000
cd frontend && npm run dev  # Port 3000
```

### Critical Architecture Decision
- Frontend CANNOT call GitLab API directly (CORS blocked)
- All GitLab API calls go through backend proxy at `/api/gitlab/*`
- Authentication uses server sessions, not browser localStorage

## Key Tool Usage Instructions

### 🔧 zen Tool Usage (Complex Analysis & Problem-Solving)

zen tools are your primary assistant for complex tasks. Use them liberally:

#### For Architecture & Design
```bash
# Analyze overall architecture
mcp__zen__analyze --analysis_type architecture --model gemini-2.5-pro

# Get design recommendations
mcp__zen__chat --prompt "Review the current authentication flow and suggest improvements" --model o3

# Refactor suggestions
mcp__zen__refactor --refactor_type modernize --model gemini-2.5-flash
```

#### For Debugging Complex Issues
```bash
# Systematic debugging with evidence
mcp__zen__debug --model o3-mini --thinking_mode high

# Example: Debug authentication issues
mcp__zen__debug --step "User reports login works but permissions don't persist" --step_number 1 --total_steps 3 --model o3
```

#### For Code Review & Security
```bash
# Comprehensive security audit
mcp__zen__secaudit --audit_focus owasp --model gemini-2.5-pro

# Code review for new features
mcp__zen__codereview --review_type full --model o3
```

#### For Test Generation
```bash
# Generate comprehensive test suite
mcp__zen__testgen --model o3 --thinking_mode high
```

### 🎭 playwright-mcp Tool Usage (UI Testing & Verification)

Use playwright-mcp for ALL UI testing and verification:

#### Basic Navigation & Testing
```bash
# Navigate to app
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000"

# Get page state (ALWAYS do this before interactions)
mcp__playwright-mcp__browser_snapshot

# Login flow
mcp__playwright-mcp__browser_click --element "Email input" --ref "input[name='email']"
mcp__playwright-mcp__browser_type --element "Email input" --ref "input[name='email']" --text "admin@example.com"
```

#### Testing Patterns
1. **ALWAYS snapshot before interacting**:
   - Use `browser_snapshot` to get current page state
   - Extract element references from snapshot
   - Use those refs in interaction commands

2. **Test user flows systematically**:
   ```bash
   # Example: Test group creation
   mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/groups"
   mcp__playwright-mcp__browser_snapshot
   mcp__playwright-mcp__browser_click --element "Create Group button" --ref "button[data-testid='create-group']"
   mcp__playwright-mcp__browser_type --element "Group name" --ref "input[name='name']" --text "Test Group"
   mcp__playwright-mcp__browser_click --element "Submit" --ref "button[type='submit']"
   ```

3. **Verify results**:
   ```bash
   # Take screenshots for visual verification
   mcp__playwright-mcp__browser_take_screenshot --filename "group-created.png"
   
   # Check for success messages
   mcp__playwright-mcp__browser_snapshot
   # Look for success toast/notification in snapshot
   ```

### Running Playwright E2E Tests
```bash
cd frontend
npx playwright test                    # Run all tests
npx playwright test --ui              # Interactive UI mode
npx playwright test --debug           # Debug mode
npx playwright test --grep @critical  # Run critical tests only
npx playwright test --project=chromium # Test specific browser

# Run comprehensive test suite
./e2e/run-all-tests.sh               # Full suite with HTML report
```

## Common Development Workflows

### 1. Adding New Feature (zen + playwright-mcp)
```bash
# Step 1: Analyze requirements with zen
mcp__zen__chat --prompt "I need to add a feature for bulk project archiving. Review the current architecture and suggest implementation approach" --model o3

# Step 2: Generate implementation plan
mcp__zen__planner --step "Plan bulk archive feature" --model gemini-2.5-pro

# Step 3: Implement with guidance
# ... write code based on zen recommendations ...

# Step 4: Test with playwright-mcp
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/projects"
mcp__playwright-mcp__browser_snapshot
# ... test the new feature ...

# Step 5: Generate tests
mcp__zen__testgen --model o3 --thinking_mode high
```

### 2. Debugging Issues (zen + playwright-mcp)
```bash
# Step 1: Reproduce with playwright-mcp
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/login"
mcp__playwright-mcp__browser_snapshot
# ... reproduce the issue ...

# Step 2: Analyze with zen
mcp__zen__debug --step "Login succeeds but user permissions not applied" --model o3 --thinking_mode high

# Step 3: Implement fix based on zen analysis
# ... apply fixes ...

# Step 4: Verify fix with playwright-mcp
# ... test the fix ...
```

### 3. Performance Optimization
```bash
# Analyze performance bottlenecks
mcp__zen__analyze --analysis_type performance --model gemini-2.5-pro

# Test performance improvements
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/projects"
# Check load times and responsiveness
```

## Project Structure & Key Files

### Frontend Structure
```
frontend/
├── src/
│   ├── services/gitlab.ts      # GitLab API client (uses backend proxy)
│   ├── store/
│   │   ├── slices/authSlice.ts # Auth state management
│   │   └── slices/uiSlice.ts   # UI state
│   ├── pages/                  # Route components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── GroupManagement.tsx
│   │   └── ProjectManagement.tsx
│   ├── components/
│   │   ├── GitLabTree.tsx      # Tree view component
│   │   └── bulk/               # CSV import components
│   └── types/                  # TypeScript definitions
├── e2e/                        # Playwright E2E tests
│   ├── tests/                  # Test files
│   └── run-all-tests.sh        # Comprehensive test runner
└── playwright.config.ts        # Playwright configuration
```

### Backend Structure
```
backend/
├── src/
│   ├── index.js               # Express server setup
│   ├── routes/
│   │   ├── auth.js            # Login/logout endpoints
│   │   └── gitlab.js          # GitLab API proxy
│   ├── services/
│   │   ├── gitlabProxy.js     # Proxy implementation
│   │   └── websocket.js       # Real-time updates
│   └── middleware/
│       └── auth.js            # Session validation
└── .env.example               # Environment config template
```

## Common Issues & Solutions

### API 401 Errors
```bash
# Debug with zen
mcp__zen__debug --step "Getting 401 errors on all API calls" --model o3

# Common causes:
# 1. Session expired - re-login
# 2. Backend not running - check port 4000
# 3. Token invalid - verify GitLab PAT
```

### CORS Errors
```bash
# This means frontend is calling GitLab directly
# Check frontend/src/services/gitlab.ts
# Should use: baseURL: '/api/gitlab' not 'https://gitlab.com/api/v4'
```

### Permission Issues
```bash
# Debug with zen
mcp__zen__debug --step "User logged in but can't access Monitoring page" --model o3

# Test with playwright-mcp
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/monitoring"
mcp__playwright-mcp__browser_snapshot
# Check for permission errors in snapshot
```

## Testing Strategy

### Unit Tests
```bash
cd frontend
npm test                    # Run all tests
npm run test:watch         # TDD mode
npm run test:coverage      # Coverage report
```

### E2E Tests with Playwright
```bash
# Always test critical paths:
# 1. Login flow
# 2. Group CRUD operations
# 3. Project tree navigation
# 4. Bulk CSV imports
# 5. Permission checks

# Use the comprehensive test suite
./e2e/run-all-tests.sh
```

### Manual Testing with playwright-mcp
Always test these scenarios:
1. Fresh login with valid credentials
2. Navigate all main pages
3. Create/edit/delete operations
4. CSV bulk imports
5. Error handling (invalid data, API failures)
6. Permission restrictions by role

## Security Considerations

### Regular Security Audits
```bash
# Run comprehensive security audit
mcp__zen__secaudit --audit_focus comprehensive --model gemini-2.5-pro

# Check for OWASP vulnerabilities
mcp__zen__secaudit --audit_focus owasp --compliance_requirements "OWASP Top 10" --model o3
```

### Key Security Points
- GitLab tokens stored in server sessions only
- httpOnly cookies prevent XSS token theft
- Backend validates all requests
- Rate limiting on API endpoints
- Input sanitization on both frontend and backend

## Performance Guidelines

### Analyze Performance
```bash
# Regular performance analysis
mcp__zen__analyze --analysis_type performance --model gemini-2.5-flash

# Test with large datasets
mcp__playwright-mcp__browser_navigate --url "http://localhost:3000/projects"
# Import 1000+ projects and test tree performance
```

### Optimization Points
- Virtual scrolling for large lists (react-window)
- Lazy loading in GitLabTree component
- Pagination for API requests
- Debounced search inputs
- Memoized expensive computations

## GitLab API Integration

### Required Token Scopes
- `api` - Full API access
- `read_api` - Read access
- `read_repository` - Repository read
- `write_repository` - Repository write

### Common API Patterns
```typescript
// Always use the proxy
const client = getGitLabClient(); // Uses /api/gitlab base URL

// Paginated requests
const getAllGroups = async () => {
  let page = 1;
  let allGroups = [];
  while (true) {
    const response = await client.get('/groups', {
      params: { page, per_page: 100 }
    });
    allGroups = [...allGroups, ...response.data];
    if (response.data.length < 100) break;
    page++;
  }
  return allGroups;
};
```

## Best Practices

### 1. Always Use zen for Complex Tasks
- Architecture decisions
- Debugging mysterious issues
- Performance optimization
- Security reviews
- Test generation

### 2. Always Test UI Changes with playwright-mcp
- Navigate to affected pages
- Take snapshots before/after
- Test all user interactions
- Verify error handling

### 3. Follow Existing Patterns
- Check similar components before creating new ones
- Use existing services and utilities
- Follow Redux patterns for state management
- Maintain TypeScript type safety

### 4. Document Important Changes
- Update this CLAUDE.md for architectural changes
- Add JSDoc comments for complex functions
- Update README.md for user-facing changes

## Debugging Commands

```bash
# Backend debugging
cd backend
LOG_LEVEL=debug npm run dev

# Frontend debugging
cd frontend
# Open Chrome DevTools
# Check Network tab for API calls
# Check Console for errors
# Use React DevTools for component state

# Test specific scenarios with playwright-mcp
mcp__playwright-mcp__browser_console_messages  # Get console errors
mcp__playwright-mcp__browser_network_requests  # Check API calls
```

## Contact & Resources

- GitLab API Docs: https://docs.gitlab.com/ee/api/
- React Docs: https://react.dev/
- Material-UI: https://mui.com/
- Playwright: https://playwright.dev/

Remember: When in doubt, use zen tools for analysis and playwright-mcp for testing!