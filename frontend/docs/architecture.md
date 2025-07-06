# Architecture

## Overview

The GitLab Bulk Manager frontend is built as a Single Page Application (SPA) using React and TypeScript. It follows a component-based architecture with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Pages     │  │  Components  │  │     Services     │   │
│  │             │  │              │  │                  │   │
│  │ Dashboard   │  │  GitLabTree  │  │  GitLabService   │   │
│  │ Groups      │  │  Layout      │  │  AuthService     │   │
│  │ Projects    │  │  Bulk/*      │  │  JobService      │   │
│  │ BulkOps     │  │  Common/*    │  │                  │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  State Management                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │   Store    │  │   Slices   │  │  RTK Query   │  │   │
│  │  │            │  │            │  │              │  │   │
│  │  │ AppStore   │  │ AuthSlice  │  │ GitLabAPI    │  │   │
│  │  │            │  │ UISlice    │  │ JobsAPI      │  │   │
│  │  └────────────┘  └────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                     │
├─────────────────────────────────────────────────────────────┤
│                     GitLab API Proxy                         │
│                     Job Queue System                         │
│                     WebSocket Server                         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      GitLab Instance                         │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Component Architecture

#### Page Components
Located in `/src/pages/`, these are top-level route components:
- **Dashboard**: Overview and statistics
- **GroupManagement**: Group CRUD operations
- **ProjectManagement**: Project management with tree view
- **BulkOperations**: CSV import operations
- **Jobs**: Background job monitoring

#### Shared Components
Located in `/src/components/`:
- **GitLabTree**: Reusable tree view for groups/projects with drag-and-drop
- **PermissionTree**: Hierarchical permission visualization
- **Layout**: App shell with navigation
- **ErrorBoundary**: Global error handling
- **PrivateRoute**: Authentication guard

#### Feature Components
Organized by feature in subdirectories:
- `/components/bulk/`: Import components for groups, projects, members
- `/components/common/`: Shared UI components
- `/components/dialogs/`: Modal dialogs

### State Management

#### Redux Store Structure
```typescript
{
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    gitlabUrl: string | null;
    token: string | null;
    loading: boolean;
    error: string | null;
  },
  ui: {
    loading: boolean;
    error: string | null;
    notifications: Notification[];
  },
  // RTK Query managed state
  api: {
    gitlab: { /* query cache */ },
    jobs: { /* query cache */ }
  }
}
```

#### RTK Query APIs
- **GitLab API**: Handles all GitLab REST API calls
- **Jobs API**: Manages background job operations
- Automatic caching and invalidation
- Optimistic updates for better UX

### Service Layer

#### GitLabService
Central service for GitLab API operations:
```typescript
interface GitLabService {
  // Groups
  getGroups(params?: GroupParams): Promise<Group[]>
  createGroup(data: CreateGroupData): Promise<Group>
  updateGroup(id: number, data: UpdateGroupData): Promise<Group>
  deleteGroup(id: number): Promise<void>
  
  // Projects
  getProjects(params?: ProjectParams): Promise<Project[]>
  getGroupProjects(groupId: number): Promise<Project[]>
  createProject(data: CreateProjectData): Promise<Project>
  
  // Members
  getGroupMembers(groupId: number): Promise<Member[]>
  addGroupMember(groupId: number, data: AddMemberData): Promise<Member>
}
```

### Routing Strategy

Using React Router v6 with nested routes:
```typescript
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="groups" element={<GroupManagement />} />
    <Route path="projects" element={<ProjectManagement />} />
    <Route path="bulk-operations" element={<BulkOperations />} />
    <Route path="jobs" element={<Jobs />} />
  </Route>
</Routes>
```

### Data Flow

1. **User Action** → Component event handler
2. **API Call** → Service method or RTK Query mutation
3. **State Update** → Redux store update
4. **UI Update** → React re-render with new data

### Security Considerations

#### Authentication
- Token-based authentication with GitLab PAT
- Tokens stored in localStorage (consider more secure alternatives)
- All API requests include authorization header

#### API Security
- CORS configuration on backend
- Request validation
- Rate limiting (backend)
- Input sanitization

### Performance Patterns

#### Code Splitting
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BulkOperations = lazy(() => import('./pages/BulkOperations'));
```

#### Memoization
```typescript
const MemoizedTree = memo(GitLabTree, (prev, next) => {
  return prev.selectedNodeId === next.selectedNodeId;
});
```

#### Virtual Scrolling
For large lists, consider implementing virtual scrolling:
```typescript
import { VariableSizeList } from 'react-window';
```

### Error Handling

#### Global Error Boundary
Catches unhandled errors and displays fallback UI:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

#### API Error Handling
Consistent error handling across all API calls:
```typescript
try {
  const result = await api.call();
} catch (error) {
  if (error.response?.status === 401) {
    // Handle authentication error
  } else {
    // Show error notification
  }
}
```

### Testing Strategy

#### Unit Tests
- Component testing with React Testing Library
- Service layer testing with Jest
- Redux slice testing

#### Integration Tests
- API integration tests
- Component integration tests

#### E2E Tests
- Playwright for end-to-end testing
- Critical user flows coverage