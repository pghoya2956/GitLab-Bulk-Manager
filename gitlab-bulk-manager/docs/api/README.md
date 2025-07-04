# API Documentation

The GitLab Bulk Manager API provides endpoints for authentication, GitLab resource management, and real-time updates.

## Base URL

```
Development: http://localhost:4000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses session-based authentication with httpOnly cookies.

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "gitlabUrl": "https://gitlab.com",
  "token": "your-personal-access-token"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "john.doe",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "admin",
    "permissions": ["create_group", "delete_group", "create_project", "delete_project"]
  }
}
```

### Logout
```http
POST /auth/logout
```

### Check Status
```http
GET /auth/status
```

## GitLab Resources

All GitLab API endpoints are proxied through `/api/gitlab/*`.

### Groups

#### List Groups
```http
GET /gitlab/groups
```

Query Parameters:
- `page` (number): Page number for pagination
- `per_page` (number): Items per page (max 100)
- `search` (string): Search groups by name
- `order_by` (string): Sort field (name, path, id)
- `sort` (string): Sort order (asc, desc)

#### Get Group
```http
GET /gitlab/groups/:id
```

#### Create Group
```http
POST /gitlab/groups
Content-Type: application/json

{
  "name": "My Group",
  "path": "my-group",
  "description": "Group description",
  "visibility": "private",
  "parent_id": 123
}
```

#### Update Group
```http
PUT /gitlab/groups/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "visibility": "internal"
}
```

#### Delete Group
```http
DELETE /gitlab/groups/:id
```

### Projects

#### List Projects
```http
GET /gitlab/projects
```

Query Parameters:
- `page` (number): Page number
- `per_page` (number): Items per page
- `search` (string): Search projects
- `membership` (boolean): Limit to projects user is member of
- `simple` (boolean): Return simplified representation

#### Get Project
```http
GET /gitlab/projects/:id
```

#### Create Project
```http
POST /gitlab/projects
Content-Type: application/json

{
  "name": "My Project",
  "path": "my-project",
  "namespace_id": 123,
  "description": "Project description",
  "visibility": "private",
  "issues_enabled": true,
  "wiki_enabled": true,
  "default_branch": "main"
}
```

#### Update Project
```http
PUT /gitlab/projects/:id
Content-Type: application/json

{
  "name": "Updated Project",
  "description": "Updated description"
}
```

#### Delete Project
```http
DELETE /gitlab/projects/:id
```

#### Transfer Project
```http
PUT /gitlab/projects/:id/transfer
Content-Type: application/json

{
  "namespace": 456
}
```

### Members

#### List Group Members
```http
GET /gitlab/groups/:id/members
```

#### Add Group Member
```http
POST /gitlab/groups/:id/members
Content-Type: application/json

{
  "user_id": 789,
  "access_level": 30,
  "expires_at": "2024-12-31"
}
```

Access Levels:
- 10: Guest
- 20: Reporter
- 30: Developer
- 40: Maintainer
- 50: Owner

#### Update Member Access
```http
PUT /gitlab/groups/:id/members/:user_id
Content-Type: application/json

{
  "access_level": 40
}
```

#### Remove Member
```http
DELETE /gitlab/groups/:id/members/:user_id
```

## Job Management

### List Jobs
```http
GET /jobs
```

Query Parameters:
- `status` (string): Filter by status (pending, running, completed, failed)
- `type` (string): Filter by job type

**Response:**
```json
{
  "jobs": [
    {
      "id": "job-123",
      "type": "bulk_create_groups",
      "status": "running",
      "progress": 45,
      "total": 100,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:05:00Z"
    }
  ]
}
```

### Get Job Details
```http
GET /jobs/:id
```

### Retry Failed Job
```http
POST /jobs/:id/retry
```

### Cancel Job
```http
DELETE /jobs/:id
```

## Bulk Operations

### Bulk Create Groups
```http
POST /gitlab/bulk/groups
Content-Type: application/json

{
  "groups": [
    {
      "name": "Group 1",
      "path": "group-1",
      "parent_id": null,
      "description": "First group",
      "visibility": "private"
    },
    {
      "name": "Group 2",
      "path": "group-2",
      "parent_id": null,
      "description": "Second group",
      "visibility": "internal"
    }
  ]
}
```

**Response:**
```json
{
  "jobId": "job-456",
  "message": "Bulk operation started",
  "totalItems": 2
}
```

### Bulk Create Projects
```http
POST /gitlab/bulk/projects
Content-Type: application/json

{
  "projects": [
    {
      "name": "Project 1",
      "group_id": 123,
      "description": "First project",
      "visibility": "private"
    }
  ]
}
```

### Bulk Add Members
```http
POST /gitlab/bulk/members
Content-Type: application/json

{
  "members": [
    {
      "username": "user1",
      "group_id": 123,
      "access_level": 30
    }
  ]
}
```

## WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
const socket = io('http://localhost:4000', {
  withCredentials: true
});
```

### Client Events (Send)

#### Subscribe to Updates
```javascript
// Subscribe to group updates
socket.emit('subscribe:groups', { groupIds: [123, 456] });

// Subscribe to project updates
socket.emit('subscribe:projects', { projectIds: [789] });

// Subscribe to job updates
socket.emit('subscribe:jobs', { jobIds: ['job-123'] });
```

### Server Events (Receive)

#### Resource Updates
```javascript
// Group events
socket.on('group:created', (data) => {
  console.log('New group:', data.group);
});

socket.on('group:updated', (data) => {
  console.log('Updated group:', data.group);
});

socket.on('group:deleted', (data) => {
  console.log('Deleted group ID:', data.groupId);
});

// Project events
socket.on('project:created', (data) => { /* ... */ });
socket.on('project:updated', (data) => { /* ... */ });
socket.on('project:deleted', (data) => { /* ... */ });
```

#### Job Updates
```javascript
socket.on('job:progress', (data) => {
  console.log(`Job ${data.jobId}: ${data.progress}/${data.total}`);
});

socket.on('job:completed', (data) => {
  console.log(`Job ${data.jobId} completed`);
});

socket.on('job:failed', (data) => {
  console.log(`Job ${data.jobId} failed:`, data.error);
});
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Not authenticated
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `GITLAB_API_ERROR`: GitLab API returned error
- `INTERNAL_ERROR`: Server error

### HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `204 No Content`: Success with no response body
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

API requests are rate-limited to prevent abuse:

- Default: 100 requests per 15 minutes per IP
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Pagination

List endpoints support pagination:

```http
GET /gitlab/groups?page=2&per_page=50
```

Pagination headers in response:
- `X-Total`: Total number of items
- `X-Total-Pages`: Total number of pages
- `X-Per-Page`: Items per page
- `X-Page`: Current page
- `X-Next-Page`: Next page number
- `X-Prev-Page`: Previous page number

## Next Steps

- Review [Authentication Guide](./authentication.md)
- Check [GitLab Proxy Details](./gitlab-proxy.md)
- Learn about [WebSocket Integration](./websocket.md)
- See [Complete API Reference](./reference.md)