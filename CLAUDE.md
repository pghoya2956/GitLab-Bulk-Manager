# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## 🚨 Critical Setup Instructions

**ALWAYS use the provided script to manage the application:**

- **Start servers**: `./manage.sh start` (kills existing processes, starts backend and frontend)
- **Stop servers**: `./manage.sh stop` (cleanly stops all processes)
- **Restart servers**: `./manage.sh restart` (stop and start with single command)
- **Check status**: `./manage.sh status` (shows running status of services)
- **View logs**: `./manage.sh logs` (tail all logs)

⚠️ Do not manually run `npm run dev` in separate terminals - the scripts handle process management properly.

## 🏗️ Architecture Overview

### Two-Tier Architecture

```
Frontend (React SPA :3000) ← → Backend (Express :4000) ← → GitLab API
```

### Backend as Proxy Pattern

- All GitLab API calls go through backend to avoid CORS
- Session-based authentication (token stored server-side only)
- Rate limiting and retry logic built-in
- WebSocket server integrated on same port (4000)

### Key API Endpoints

- `/api/auth/*` - Authentication (login/logout/session)
- `/api/gitlab/*` - Generic GitLab API proxy
- `/api/gitlab/bulk/*` - Bulk operations
  - `/subgroups` - Create multiple subgroups
  - `/projects` - Create multiple projects
  - `/settings/push-rules` - Bulk push rules (GitLab Premium)
  - `/settings/protected-branches` - Bulk protected branches
  - `/settings/visibility` - Bulk visibility changes
  - `/settings/access-levels` - Bulk access level changes
  - `/delete` - Bulk delete items
- `/api/permissions/overview` - User permission hierarchy
- `/api/stats/*` - Resource statistics
- `/api/docs/*` - Documentation endpoints (no auth required)

## 🛠️ Common Development Commands

### Development

```bash
# Start everything
./manage.sh start

# Run tests
npm test              # All tests
npm run test:e2e      # E2E tests with Playwright

# Linting
npm run lint          # Check all
npm run lint:fix      # Auto-fix issues

# Build for production
npm run build         # Build both frontend and backend
```

### Docker Operations

```bash
npm run docker:build  # Build containers
npm run docker:up     # Start containers
npm run docker:down   # Stop containers
```

## 🔧 Technical Implementation Details

### Authentication Flow

1. User provides GitLab URL + Personal Access Token
2. Backend validates via `/api/v4/user` endpoint
3. Creates session with httpOnly cookie (`connect.sid`)
4. Token stored in `req.session.gitlabToken` (never sent to frontend)
5. All API calls authenticated via `authenticateToken` middleware

### WebSocket Architecture

- Real-time updates for bulk operations
- Job tracking with progress updates
- Subscription model: `subscribe:job:${jobId}`, `subscribe:group:${groupId}`
- Auto-cleanup on disconnect

### State Management

- **Redux Toolkit** for global state (auth, gitlab resources, UI)
- **React Query** for server state and caching
- **Local component state** for UI-only concerns

### Bulk Operations Implementation

```javascript
// Rate limiting configuration
const delay = options?.delay || 200; // ms between requests
const maxRetries = 3;
```

- YAML parsing with js-yaml
- Recursive group/project creation
- Exponential backoff on failures
- Progress tracking via WebSocket

## 📁 Key File Locations

### Backend Structure

```
backend/src/
├── index.js              # Server setup, middleware, routes
├── routes/
│   ├── auth.js          # Login/logout endpoints
│   ├── gitlab.js        # GitLab API proxy
│   ├── bulk.js          # Bulk operations
│   ├── stats.js         # Statistics endpoints
│   ├── permissions.js   # Permission overview
│   └── docs.js          # Documentation serving
├── middleware/
│   └── auth.js          # Session authentication
└── services/
    └── websocket.js     # Socket.io implementation
```

### Frontend Structure

```
frontend/src/
├── pages/
│   ├── GroupsProjects.tsx  # Main page with tree view
│   ├── SystemHealth.tsx    # System monitoring
│   └── Documentation.tsx   # Documentation viewer (Korean only)
├── components/
│   ├── DocumentationViewer.tsx # Markdown renderer (no rehype-raw for security)
│   ├── GitLabTree.tsx      # Group/project tree with permissions
│   └── bulk/               # Bulk operation dialogs and forms
└── services/
    └── gitlab.ts           # API client with bulk operations
```

## 🔍 Debugging Tips

### Common Issues

1. **401 Errors**

   - Check session validity: `curl http://localhost:4000/api/auth/session`
   - Verify token has `api` scope

2. **CORS Errors**

   - Ensure using `/api/gitlab/*` proxy, not direct GitLab URL
   - Check `frontend/src/services/axiosConfig.ts`

3. **Empty Member Counts**
   - Verify using `/members/all` endpoint (handled in permissions.js with fallback)

### Process Management

```bash
# Check running processes
lsof -i:3000  # Frontend
lsof -i:4000  # Backend

# Kill specific port
lsof -ti:4000 | xargs kill -9

# Check saved PIDs
cat .backend.pid
cat .frontend.pid
```

## 🚀 Performance Considerations

- Bulk operations use batching with configurable delays
- GitLabTree uses virtual scrolling for large datasets
- API responses cached with React Query (5 min default)
- Permissions endpoint makes parallel requests for efficiency

## 🌐 GitLab API Integration Notes

### Important API Differences

- `/members` - Direct members only
- `/members/all` - Includes inherited members (what we use with fallback)
- Group visibility affects API access
- Rate limits: ~600 req/min for authenticated users

### Pagination Handling

```javascript
// Backend handles transparently
const totalCount = parseInt(response.headers['x-total'] || '0');
```

## 📝 Recent Feature Details

### GitLabTree Component with Permissions

```typescript
// frontend/src/components/GitLabTree.tsx
- Integrated permissions display directly in tree view
- Fetches permission data from /api/permissions/overview
- Shows member count and access level for each item
- Developer+ filter toggle (shows only Developer and above when enabled)
- Color-coded access level badges
- Multi-select and bulk drag-and-drop support
```

### Documentation System

- Korean-only documentation at `/docs`
- Markdown rendering with Mermaid diagram support
- Pure markdown approach (no HTML for security)
- Full-width layout for better readability

### Environment Variables

**Backend (.env)**

```
PORT=4000
SESSION_SECRET=your-secret-here
GITLAB_API_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxx  # Optional default token
```

**Frontend** - No env vars needed (uses backend proxy)

## 📦 Dependencies

- Node.js >= 18.0.0
- npm >= 9.0.0
- Workspaces setup for monorepo management
