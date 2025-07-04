# Frontend Architecture

The GitLab Bulk Manager frontend is built as a modern React single-page application with TypeScript, providing a rich, responsive user interface for managing GitLab resources.

## Architecture Overview

```
frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Generic components
│   │   ├── bulk/            # Bulk operation components
│   │   ├── dialogs/         # Modal dialogs
│   │   └── GitLabTree.tsx   # Tree view component
│   │
│   ├── pages/               # Route-level components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── GroupManagement.tsx
│   │   ├── ProjectManagement.tsx
│   │   └── BulkOperations.tsx
│   │
│   ├── store/               # Redux state management
│   │   ├── index.ts         # Store configuration
│   │   ├── slices/          # Redux slices
│   │   └── api/             # RTK Query APIs
│   │
│   ├── services/            # Business logic & API
│   │   ├── gitlab.ts        # GitLab API service
│   │   ├── auth.ts          # Authentication
│   │   └── websocket.ts     # WebSocket client
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   └── useGitLab.ts
│   │
│   ├── types/               # TypeScript definitions
│   │   ├── auth.ts
│   │   ├── gitlab.ts
│   │   └── api.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── validation.ts
│   │
│   └── App.tsx              # Root component
```

## Component Architecture

### Component Hierarchy

```
App
├── Router
│   ├── PublicRoute
│   │   └── Login
│   └── PrivateRoute
│       └── Layout
│           ├── Header
│           ├── Sidebar
│           └── Main
│               ├── Dashboard
│               ├── GroupManagement
│               ├── ProjectManagement
│               ├── BulkOperations
│               └── Jobs
```

### Component Design Principles

1. **Functional Components**: All components use hooks
2. **TypeScript**: Full type safety
3. **Composition**: Favor composition over inheritance
4. **Single Responsibility**: Each component has one clear purpose
5. **Reusability**: Common components are highly reusable

### Key Components

#### GitLabTree Component
```typescript
interface GitLabTreeProps {
  onNodeSelect?: (node: TreeNode) => void;
  onNodeMove?: (source: string, target: string) => void;
  selectedNodeId?: string;
  expandedNodes?: string[];
}
```
- Hierarchical display of groups and projects
- Lazy loading for performance
- Drag & drop support
- Keyboard navigation

#### BulkImport Components
```typescript
interface BulkImportProps<T> {
  onImport: (data: T[]) => Promise<void>;
  template: string;
  validator: (data: any[]) => ValidationResult;
  preview: React.FC<{ data: T[] }>;
}
```
- Generic CSV import functionality
- Real-time validation
- Preview before import
- Progress tracking

## State Management

### Redux Store Structure

```typescript
interface RootState {
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    gitlabUrl: string;
    token: string;
  };
  ui: {
    loading: boolean;
    error: string | null;
    notifications: Notification[];
    theme: 'light' | 'dark';
  };
  gitlab: {
    // Managed by RTK Query
  };
  jobs: {
    activeJobs: Job[];
    jobHistory: Job[];
  };
}
```

### State Management Patterns

#### 1. Authentication Slice
```typescript
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
    },
    logout: (state) => {
      return initialState;
    }
  }
});
```

#### 2. RTK Query for API
```typescript
const gitlabApi = createApi({
  reducerPath: 'gitlabApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/gitlab',
    prepareHeaders: (headers) => {
      // Session auth handled by cookies
      return headers;
    }
  }),
  tagTypes: ['Group', 'Project', 'Member'],
  endpoints: (builder) => ({
    getGroups: builder.query<Group[], void>({
      query: () => '/groups',
      providesTags: ['Group']
    }),
    createGroup: builder.mutation<Group, CreateGroupDto>({
      query: (body) => ({
        url: '/groups',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Group']
    })
  })
});
```

### State Update Flow

1. **User Action** → Component event handler
2. **Dispatch Action** → Redux action or RTK Query mutation
3. **Middleware** → Thunks, RTK Query middleware
4. **Reducer** → State update
5. **Selectors** → Compute derived state
6. **Re-render** → Components update

## Routing Strategy

### Route Configuration

```typescript
const routes = [
  { path: '/login', element: <Login />, public: true },
  { path: '/', element: <Navigate to="/dashboard" /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/groups', element: <GroupManagement /> },
  { path: '/projects', element: <ProjectManagement /> },
  { path: '/bulk-operations', element: <BulkOperations /> },
  { path: '/jobs', element: <Jobs /> },
  { path: '/monitoring', element: <Monitoring />, requiredRole: 'admin' },
  { path: '/backup', element: <Backup />, requiredRole: 'admin' }
];
```

### Route Protection

```typescript
const PrivateRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};
```

## Data Fetching Patterns

### RTK Query Hooks

```typescript
// In components
const { data: groups, isLoading, error } = useGetGroupsQuery();
const [createGroup] = useCreateGroupMutation();

// With parameters
const { data: projects } = useGetGroupProjectsQuery(groupId, {
  skip: !groupId
});
```

### Optimistic Updates

```typescript
createGroup: builder.mutation({
  query: (body) => ({ url: '/groups', method: 'POST', body }),
  onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
    // Optimistically update cache
    const patchResult = dispatch(
      api.util.updateQueryData('getGroups', undefined, (draft) => {
        draft.push({ ...arg, id: 'temp-id' });
      })
    );
    try {
      await queryFulfilled;
    } catch {
      patchResult.undo();
    }
  }
})
```

## Performance Optimization

### Code Splitting

```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BulkOperations = lazy(() => import('./pages/BulkOperations'));

// In App.tsx
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</Suspense>
```

### Memoization

```typescript
// Component memoization
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* Render logic */}</div>;
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id;
});

// Selector memoization
const selectFilteredProjects = createSelector(
  [selectAllProjects, selectSearchTerm],
  (projects, searchTerm) => 
    projects.filter(p => p.name.includes(searchTerm))
);
```

### Virtual Scrolling

```typescript
import { VariableSizeList } from 'react-window';

const VirtualProjectList = ({ projects }) => (
  <VariableSizeList
    height={600}
    itemCount={projects.length}
    itemSize={() => 50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <ProjectItem project={projects[index]} />
      </div>
    )}
  </VariableSizeList>
);
```

## Testing Strategy

### Unit Testing

```typescript
// Component testing
describe('GroupManagement', () => {
  it('displays groups list', async () => {
    render(<GroupManagement />, { wrapper: TestWrapper });
    
    await waitFor(() => {
      expect(screen.getByText('My Group')).toBeInTheDocument();
    });
  });
});
```

### Integration Testing

```typescript
// API integration
describe('GitLab Service', () => {
  it('creates group successfully', async () => {
    const group = await gitlabService.createGroup({
      name: 'Test Group',
      path: 'test-group'
    });
    
    expect(group.id).toBeDefined();
  });
});
```

## Build Configuration

### Vite Configuration

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@mui/material'],
          redux: ['@reduxjs/toolkit', 'react-redux']
        }
      }
    }
  }
});
```

## Best Practices

### 1. Component Guidelines
- Keep components small and focused
- Use TypeScript interfaces for all props
- Implement error boundaries
- Add loading states
- Handle edge cases

### 2. State Management
- Keep state as local as possible
- Use RTK Query for server state
- Normalize complex data structures
- Avoid state duplication

### 3. Performance
- Lazy load routes and heavy components
- Memoize expensive computations
- Use virtual scrolling for long lists
- Debounce user input
- Optimize re-renders

### 4. Code Quality
- Follow ESLint rules
- Write comprehensive tests
- Document complex logic
- Use meaningful variable names
- Keep files under 200 lines

## Next Steps

- Review [Backend Architecture](./backend.md)
- Understand [API Integration](../api/README.md)
- Learn about [Component Development](../development/frontend-guide.md)
- Set up [Testing](../development/testing.md)