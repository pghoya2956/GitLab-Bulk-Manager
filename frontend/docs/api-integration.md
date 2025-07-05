# API Integration

## Overview

The frontend communicates with GitLab through a backend proxy API that handles authentication, request formatting, and response transformation.

## API Architecture

```
Frontend → Backend API → GitLab API
    ↓          ↓             ↓
  Axios    Express.js   GitLab REST API
```

## Authentication

### Login Flow
1. User provides GitLab URL and Personal Access Token
2. Frontend validates credentials with test API call
3. Credentials stored in localStorage
4. All subsequent requests include auth headers

### Request Headers
```typescript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-GitLab-URL': gitlabUrl
}
```

## GitLab Service

### Configuration
```typescript
// src/services/gitlab.ts
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
});

// Request interceptor
client.interceptors.request.use((config) => {
  const auth = store.getState().auth;
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
    config.headers['X-GitLab-URL'] = auth.gitlabUrl;
  }
  return config;
});
```

### Error Handling
```typescript
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle authentication error
      store.dispatch(logout());
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## API Methods

### Groups API

#### Get Groups
```typescript
async getGroups(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  top_level_only?: boolean;
  parent_id?: number;
}) {
  const response = await client.get('/api/groups', { params });
  return response.data;
}
```

#### Create Group
```typescript
async createGroup(data: {
  name: string;
  path: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  parent_id?: number;
}) {
  const response = await client.post('/api/groups', data);
  return response.data;
}
```

#### Update Group
```typescript
async updateGroup(id: number, data: Partial<GroupData>) {
  const response = await client.put(`/api/groups/${id}`, data);
  return response.data;
}
```

#### Delete Group
```typescript
async deleteGroup(id: number) {
  await client.delete(`/api/groups/${id}`);
}
```

### Projects API

#### Get Projects
```typescript
async getProjects(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  membership?: boolean;
}) {
  const response = await client.get('/api/projects', { params });
  return response.data;
}
```

#### Get Group Projects
```typescript
async getGroupProjects(groupId: number) {
  const response = await client.get(`/api/groups/${groupId}/projects`);
  return response.data;
}
```

#### Create Project
```typescript
async createProject(data: {
  name: string;
  namespace_id: number;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  initialize_with_readme?: boolean;
  default_branch?: string;
}) {
  const response = await client.post('/api/projects', data);
  return response.data;
}
```

### Members API

#### Get Group Members
```typescript
async getGroupMembers(groupId: number) {
  const response = await client.get(`/api/groups/${groupId}/members`);
  return response.data;
}
```

#### Add Group Member
```typescript
async addGroupMember(groupId: number, data: {
  user_id: number;
  access_level: number;
  expires_at?: string;
}) {
  const response = await client.post(`/api/groups/${groupId}/members`, data);
  return response.data;
}
```

#### Search Users
```typescript
async getUsers(params?: { search?: string }) {
  const response = await client.get('/api/users', { params });
  return response.data;
}
```

### Jobs API

#### Start Bulk Import Job
```typescript
async startBulkImport(data: {
  type: 'groups' | 'projects' | 'members';
  file: File;
  options?: ImportOptions;
}) {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('type', data.type);
  if (data.options) {
    formData.append('options', JSON.stringify(data.options));
  }
  
  const response = await client.post('/api/jobs/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}
```

#### Get Job Status
```typescript
async getJobStatus(jobId: string) {
  const response = await client.get(`/api/jobs/${jobId}`);
  return response.data;
}
```

## RTK Query Integration

### API Slice Definition
```typescript
// src/store/api/gitlabApi.ts
export const gitlabApi = createApi({
  reducerPath: 'gitlabApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_API_URL}/api`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Group', 'Project', 'Member'],
  endpoints: (builder) => ({
    // Define endpoints here
  }),
});
```

### Query Example
```typescript
// Get groups with caching
getGroups: builder.query<Group[], GroupParams>({
  query: (params) => ({
    url: '/groups',
    params,
  }),
  providesTags: (result) =>
    result
      ? [...result.map(({ id }) => ({ type: 'Group' as const, id })), 'Group']
      : ['Group'],
}),
```

### Mutation Example
```typescript
// Create group with cache invalidation
createGroup: builder.mutation<Group, CreateGroupData>({
  query: (data) => ({
    url: '/groups',
    method: 'POST',
    body: data,
  }),
  invalidatesTags: ['Group'],
}),
```

## WebSocket Integration

### Connection Setup
```typescript
// src/services/websocket.ts
class WebSocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io(import.meta.env.VITE_WS_URL, {
      auth: { token },
    });

    this.socket.on('job:update', (data) => {
      store.dispatch(updateJobStatus(data));
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
```

### Job Progress Updates
```typescript
// Listen for job updates
socket.on('job:progress', (data: {
  jobId: string;
  progress: number;
  status: string;
}) => {
  // Update UI with progress
});
```

## Error Response Format

### Standard Error Response
```typescript
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  status: number;
}
```

### Error Handling Example
```typescript
try {
  const result = await gitlabService.createGroup(data);
  showSuccess('Group created successfully');
} catch (error) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message || 'An error occurred';
    showError(message);
  }
}
```

## Pagination

### Request Parameters
```typescript
interface PaginationParams {
  page: number;      // Current page (1-based)
  per_page: number;  // Items per page (max 100)
}
```

### Response Headers
```typescript
{
  'X-Total': '150',        // Total number of items
  'X-Total-Pages': '15',   // Total number of pages
  'X-Per-Page': '10',      // Items per page
  'X-Page': '1',           // Current page
  'X-Next-Page': '2',      // Next page number
  'X-Prev-Page': '',       // Previous page number
}
```

### Pagination Hook
```typescript
function usePagination(fetchFn: Function) {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  const { data, headers } = useQuery(
    ['items', page],
    () => fetchFn({ page, per_page: 20 })
  );
  
  useEffect(() => {
    if (headers) {
      setTotalPages(parseInt(headers['x-total-pages'] || '0'));
    }
  }, [headers]);
  
  return { data, page, totalPages, setPage };
}
```

## Best Practices

### Request Cancellation
```typescript
const controller = new AbortController();

const fetchData = async () => {
  try {
    const response = await client.get('/api/groups', {
      signal: controller.signal
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('Request cancelled');
    }
  }
};

// Cancel request
controller.abort();
```

### Rate Limiting
Respect GitLab's rate limits:
- 600 requests per minute for authenticated requests
- Implement retry logic with exponential backoff
- Show user-friendly messages when rate limited

### Caching Strategy
- Use RTK Query for automatic caching
- Set appropriate cache lifetimes
- Invalidate cache on mutations
- Implement optimistic updates for better UX