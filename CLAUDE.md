# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitLab Bulk Manager - A web application for efficiently managing GitLab groups and projects with bulk operations support.

**Architecture**: 
- Frontend: React 18 + TypeScript + Material-UI (port 3000)
- Backend: Node.js/Express proxy server (port 4000)
- Pattern: Backend proxy to avoid CORS, session-based auth with httpOnly cookies

## Essential Commands

### Development
```bash
# Start both servers (recommended)
./start.sh

# Or run separately
cd backend && npm run dev   # Port 4000
cd frontend && npm run dev  # Port 3000
```

### Testing
```bash
# Frontend tests
cd frontend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Linting
npm run lint               # Check for issues
npm run lint:fix          # Auto-fix issues

# E2E tests
npx playwright test        # Run all E2E tests
npx playwright test --ui   # Interactive mode
```

### Build
```bash
# Frontend build
cd frontend && npm run build

# Backend (no build needed - ES modules)
cd backend && npm start
```

## Critical Architecture Decisions

1. **GitLab API Proxy Pattern**
   - Frontend CANNOT call GitLab API directly (CORS)
   - All GitLab calls go through `/api/gitlab/*`
   - Token stored in server session only

2. **Authentication Flow**
   - Login: POST `/api/auth/login` with GitLab token
   - Session stored in httpOnly cookie
   - Frontend never sees the actual token

3. **Key Integration Points**
   - `frontend/src/services/gitlab.ts` - API client using proxy
   - `backend/src/routes/gitlab.js` - Proxy implementation
   - `backend/src/routes/bulk.js` - Bulk operations (YAML/hierarchy)

## Core Features & Implementation

### 1. Groups & Projects Management (`/groups-projects`)
- **Component**: `frontend/src/pages/GroupsProjects.tsx`
- **Features**: Tree view, drag-drop reorganization, multi-select
- **Key API**: Uses GitLabTree component with virtual scrolling

### 2. Bulk Import (`/bulk-import`)
- **Component**: `frontend/src/pages/BulkImport.tsx`
- **Sub-components**:
  - `YamlEditor.tsx` - YAML-based bulk operations
  - `HierarchyBuilder.tsx` - Visual hierarchy builder
  - `ImportGroups.tsx` - Legacy CSV import
- **Backend**: `/api/gitlab/bulk/subgroups`, `/api/gitlab/bulk/projects`

### 3. System Health (`/system-health`)
- **Component**: `frontend/src/pages/SystemHealth.tsx`
- **Backend**: `/api/gitlab/bulk/health-check`
- **Shows**: Auth status, resource counts, API rate limits

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server setup
│   │   ├── routes/
│   │   │   ├── auth.js       # Login/logout
│   │   │   ├── gitlab.js     # GitLab API proxy
│   │   │   └── bulk.js       # Bulk operations
│   │   └── middleware/
│   │       └── auth.js       # Session validation
│   └── .env.example          # Required: GITLAB_TOKEN
│
└── frontend/
    ├── src/
    │   ├── services/
    │   │   └── gitlab.ts     # API client (uses proxy)
    │   ├── pages/            # Route components
    │   ├── components/
    │   │   ├── GitLabTree.tsx
    │   │   └── bulk/         # Bulk operation components
    │   └── store/            # Redux state management
    └── playwright.config.ts  # E2E test config
```

## Common Issues & Solutions

### 401 Authentication Errors
- Session expired → Re-login
- Backend not running → Check port 4000
- Invalid token → Verify GitLab PAT has `api` scope

### CORS Errors
Frontend calling GitLab directly. Check:
- `frontend/src/services/gitlab.ts` should use `/api/gitlab`
- NOT `https://gitlab.com/api/v4`

### Bulk Operations Rate Limiting
- Default delay: 200ms between API calls
- Exponential backoff on failures
- Configurable in YAML options

## API Patterns

### Proxy Usage
```typescript
// frontend/src/services/gitlab.ts
const client = getGitLabClient(); // baseURL: '/api/gitlab'
await client.get('/groups');
```

### Bulk Operations
```yaml
# Subgroups creation
parent_id: 123
subgroups:
  - name: Backend
    path: backend
    subgroups:
      - name: API
        path: api
```

## Testing Approach

1. **Unit Tests**: Component logic, Redux actions
2. **E2E Tests**: Critical user flows with Playwright
   - Login flow
   - Group/Project CRUD
   - Bulk imports
   - Drag-drop operations

## Environment Variables

### Backend (.env)
```
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your-token-here
PORT=4000
SESSION_SECRET=random-secret
```

### Frontend
No env vars needed - uses backend proxy

## Key Dependencies

- **Frontend**: React 18, MUI 5, Redux Toolkit, Axios, React Router 6
- **Backend**: Express, js-yaml, axios, express-session
- **Shared**: Socket.io (for real-time updates - underutilized)

## Performance Considerations

- Tree view uses virtual scrolling for large datasets
- Bulk operations process with rate limiting
- API responses cached in Redux where appropriate
- Pagination handled automatically by GitLabTree

## Security Notes

- GitLab tokens never exposed to frontend
- Session-based auth with httpOnly cookies
- Input validation on both frontend and backend
- Rate limiting on all API endpoints