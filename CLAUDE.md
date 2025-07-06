# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 Critical Setup Instructions

**ALWAYS use the provided script to manage the application:**
- **Start servers**: `./manage.sh start` (kills existing processes, starts both servers)
- **Stop servers**: `./manage.sh stop` (cleanly stops all processes)
- **Restart servers**: `./manage.sh restart` (stop and start with single command)
- **Check status**: `./manage.sh status` (shows running status of services)
- **View logs**: `./manage.sh logs` (tail all logs)

⚠️ Do not manually run `npm run dev` in separate terminals - the scripts handle process management properly.

## 📍 Current Project State (as of 2025-07-06)

### Recent Major Changes
1. **Consolidated Dashboard into Groups & Projects** - Removed separate Dashboard page:
   - All functionality now in Groups & Projects tab
   - Toggle between Tree View and Permissions View
   - Bulk operations toolbar for selected items
   - Integrated bulk import as a dialog

2. **Enhanced Bulk Operations** - Added comprehensive bulk management:
   - Bulk Settings: visibility, protected branches, push rules, access levels
   - Bulk Import: YAML editor and visual builder in dialog
   - Bulk Transfer: drag-and-drop multiple items
   - Bulk Delete: delete multiple items at once

3. **Member Count Fix** - Added error handling for `/members/all` endpoint with fallback to `/members` when 404 errors occur

4. **Documentation System** - Added in-app documentation viewer:
   - New Documentation page with sidebar navigation at `/docs`
   - Markdown rendering with syntax highlighting
   - Backend endpoint `/api/docs/*` serves documentation files
   - Documentation button added to main navigation

5. **Project Structure** - Moved from `gitlab-bulk-manager/` subdirectory to root directory

6. **Latest UX Improvements** (2025-07-06):
   - **Fixed bulk drag-and-drop**: Multiple selected items can now be dragged together
   - **Integrated Permissions into Tree View**: Removed separate view, now shows permissions directly in tree
   - **Added Developer+ filter**: Toggle to show only Developer access level and above
   - **Improved script management**: Consolidated start.sh and stop.sh into single manage.sh script

## 🏗️ Architecture Overview

### Three-Tier Architecture
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

## 🛠️ Common Development Tasks

### Quick Start
```bash
# Start everything
./manage.sh start

# Stop everything
./manage.sh stop

# Restart everything
./manage.sh restart

# Check service status
./manage.sh status

# View logs
./manage.sh logs
```

### Backend Development
```bash
cd backend
npm run dev       # Development with auto-reload
npm start        # Production mode
npm test         # Run tests
```

### Frontend Development
```bash
cd frontend
npm run dev      # Start Vite dev server
npm run build    # Production build
npm test         # Run tests
npm run lint     # ESLint check
npm run lint:fix # Auto-fix linting issues
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
│   ├── permissions.js   # Permission overview (NEW)
│   └── docs.js          # Documentation serving (NEW)
├── middleware/
│   └── auth.js          # Session authentication
└── services/
    └── websocket.js     # Socket.io implementation
```

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── GroupsProjects.tsx  # Main page with tree/permissions views
│   ├── SystemHealth.tsx
│   └── Documentation.tsx   # Documentation viewer
├── components/
│   ├── DocumentationViewer.tsx # Markdown renderer
│   ├── GitLabTree.tsx      # Group/project tree navigation with permissions integration
│   └── bulk/
│       ├── BulkImportDialog.tsx    # Bulk import dialog (NEW)
│       ├── BulkSettingsDialog.tsx  # Bulk settings dialog (NEW)
│       ├── BulkVisibilityForm.tsx  # Visibility settings
│       ├── BulkProtectedBranchesForm.tsx # Protected branches
│       ├── BulkPushRulesForm.tsx   # Push rules (Premium)
│       ├── BulkAccessLevelsForm.tsx # Access levels
│       ├── YamlEditor.tsx
│       └── HierarchyBuilder.tsx
└── services/
    └── gitlab.ts        # API client with bulk operations
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
   - Verify using `/members/all` endpoint (fixed in permissions.js)

4. **React Hooks Error in PermissionTree**
   - Fixed: useEffect now called before conditional returns

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
- `/members/all` - Includes inherited members (what we use)
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

### Statistics API Enhancement
```javascript
// backend/src/routes/stats.js
- Parallel requests for groups/projects/users
- 5-second timeout with fallback
- Uses pagination headers for accurate counts
```

### Environment Variables

**Backend (.env)**
```
PORT=4000
SESSION_SECRET=your-secret-here
GITLAB_API_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxx  # Optional default token
```

**Frontend** - No env vars needed (uses backend proxy)