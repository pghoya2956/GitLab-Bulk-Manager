# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start development environment (default, with hot reload)
docker compose up -d

# Start production environment
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f
docker compose logs -f backend   # Backend only
docker compose logs -f frontend  # Frontend only
```

### Testing & Quality
```bash
# Run tests in Docker containers
docker compose exec backend npm test
docker compose exec frontend npm test

# Run linting
docker compose exec backend npm run lint:fix
docker compose exec frontend npm run lint:fix

# Format code
docker compose exec frontend npm run format

# TypeScript check (frontend only)
docker compose exec frontend npx tsc --noEmit
```

### Build & Production
```bash
# Production deployment
docker compose -f docker-compose.prod.yml up -d

# Build production images
docker compose -f docker-compose.prod.yml build

# Manual build (without Docker)
cd frontend && npm run build  # TypeScript + Vite build
cd backend && npm start       # Node.js production mode
```

## High-Level Architecture

### System Overview
```
GitLab Bulk Manager
├── Frontend (Port 3030)
│   ├── React 18 + TypeScript
│   ├── Material-UI v5 for components
│   ├── Redux Toolkit for state management
│   └── Vite for bundling
│
├── Backend (Port 4050)
│   ├── Node.js + Express (ES modules, JavaScript)
│   ├── Session-based auth with Redis
│   ├── GitLab API proxy pattern
│   └── Winston for logging
│
└── Redis (Port 6379)
    └── Session storage
```

### Backend Structure
```
backend/src/
├── config/           # Configuration (constants, session, cors)
├── middleware/       # Express middleware (auth, errorHandler)
├── routes/           # API routes
│   ├── auth.js       # Authentication
│   ├── bulk.js       # Bulk operations (main)
│   ├── gitlab.js     # GitLab API proxy
│   ├── members.js    # Member management
│   ├── cicd.js       # CI/CD settings
│   ├── issues.js     # Issue management
│   └── ...
├── services/         # Business logic services
├── utils/            # Utilities (logger)
└── index.js          # Entry point
```

### Frontend Structure
```
frontend/src/
├── api/              # API client functions
├── components/       # React components
│   ├── bulk/         # Bulk operation dialogs
│   ├── common/       # Shared components
│   └── tree/         # Tree view components
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── services/         # Axios config
├── store/            # Redux store
│   └── slices/       # Redux slices
├── utils/            # Utility functions
└── App.tsx           # Root component
```

### Critical Backend Routes & Patterns

1. **Authentication Flow**
   - `/api/auth/login` - Stores GitLab token in session as `req.session.gitlabToken`
   - All protected routes use `authenticateToken` middleware
   - Session key is ALWAYS `req.session.gitlabToken`

2. **API Structure**
   - `/api/gitlab/*` - Direct GitLab API proxy
   - `/api/gitlab/bulk/*` - Bulk operations
   - All bulk operations are in `backend/src/routes/bulk.js` only

3. **Bulk Operations Endpoints**
   - `POST /api/gitlab/bulk/delete` - Bulk delete
   - `POST /api/gitlab/bulk/transfer` - Bulk transfer
   - `POST /api/gitlab/bulk/archive` - Bulk archive
   - `POST /api/gitlab/bulk/unarchive` - Bulk unarchive
   - `POST /api/gitlab/bulk/clone` - Bulk clone
   - `POST /api/gitlab/bulk/subgroups` - Create subgroups from YAML
   - `POST /api/gitlab/bulk/projects` - Bulk create projects
   - `POST /api/gitlab/bulk/settings/*` - Bulk settings changes

### Critical Frontend Patterns

1. **Main Entry Point**
   - `src/pages/BulkActionsCenterRedux.tsx` - Central hub with tree view
   - Tree component uses checkbox selection
   - IDs in tree are `group-123` or `project-456` format

2. **State Management**
   - Redux Toolkit with slices in `src/store/slices/`
   - API calls through `src/api/` directory

3. **ID Conversion Pattern**
   ```typescript
   // Tree ID to GitLab ID
   const numericId = id.includes('-')
     ? parseInt(id.split('-').pop())
     : id;
   ```

## Known Issues & Solutions

### Parameter Naming Convention
- Frontend sends: `targetNamespaceId` (camelCase)
- Backend/GitLab expects: `namespace_id` (snake_case)
- Backend must convert between formats

### React State Closure Issues
Always use functional state updates:
```javascript
setState(prev => [...prev, newItem])  // ✅ Correct
setState([...state, newItem])         // ❌ May have stale state
```

### GitLab API Constraints
- Rate limit: 60 requests/minute
- Sequential processing required (not parallel)
- Use `delay(API_RATE_LIMIT.DEFAULT_DELAY)` between requests
- Delete operations: projects first, then groups

## Recent Changes (2025-12-02)

1. **Simplified Architecture**: Removed TypeScript from backend, using JavaScript only
2. **Removed WebSocket**: All real-time features removed for simplicity
3. **Unified Structure**: Single JS-based backend structure
4. **Progress Display**: Using simple loading spinners instead of WebSocket progress

## Development Guidelines

### When Adding New Bulk Operations
1. Add endpoint to `backend/src/routes/bulk.js` only
2. Use established patterns for error handling and rate limiting
3. Return results with success/failed arrays

### When Modifying Frontend Components
1. Follow existing Material-UI patterns
2. Use TypeScript strict mode
3. Functional components with hooks only
4. Handle loading/error states properly

### Session & Authentication
- Always check `req.session.gitlabToken` and `req.session.gitlabUrl`
- Never use `req.session.token` or `req.session.accessToken`
- All authenticated routes must use `authenticateToken` middleware

### Error Handling
- Backend: Return consistent error format with status codes
- Frontend: Show user-friendly messages via snackbar
- Log errors with Winston on backend
- Never expose sensitive information in error messages
