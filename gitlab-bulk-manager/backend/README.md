# GitLab Bulk Manager - Backend

Express.js backend server that provides a secure proxy for GitLab API communication.

## Overview

The backend serves as:
- **Security Layer**: Manages GitLab tokens server-side
- **API Proxy**: Routes requests to GitLab API
- **Session Management**: Handles user authentication
- **WebSocket Server**: Provides real-time updates
- **Job Queue**: Manages asynchronous operations

## Architecture

```
backend/
├── src/
│   ├── index.js            # Express server setup
│   ├── config/             # Configuration management
│   ├── middleware/         # Express middleware
│   │   ├── auth.js         # Authentication middleware
│   │   ├── errorHandler.js # Global error handling
│   │   └── validation.js   # Request validation
│   ├── routes/             # API routes
│   │   ├── auth.js         # Authentication endpoints
│   │   ├── gitlab.js       # GitLab proxy endpoints
│   │   └── jobs.js         # Job management endpoints
│   ├── services/           # Business logic
│   │   ├── gitlabProxy.js  # GitLab API proxy
│   │   ├── jobQueue.js     # Background job processing
│   │   └── websocket.js    # WebSocket implementation
│   └── utils/              # Utility functions
│       ├── logger.js       # Winston logger setup
│       └── validators.js   # Data validators
├── tests/                  # Test files
├── .env.example            # Environment template
└── package.json            # Dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with GitLab URL and token
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/status` - Check authentication status

### GitLab Proxy
All GitLab API endpoints are proxied through `/api/gitlab/*`:
- `GET /api/gitlab/groups` - List groups
- `POST /api/gitlab/groups` - Create group
- `PUT /api/gitlab/groups/:id` - Update group
- `DELETE /api/gitlab/groups/:id` - Delete group
- And many more...

### Jobs
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:id/retry` - Retry failed job
- `DELETE /api/jobs/:id` - Cancel job

## Configuration

See `.env.example` for all configuration options:

```env
# Server
PORT=4000
NODE_ENV=development

# Session
SESSION_SECRET=your-secret-here

# Redis (optional)
REDIS_URL=redis://localhost:6379

# CORS
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Development

### Running the Server
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Lint code
npm run lint
```

### Debugging
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Use Node inspector
node --inspect src/index.js
```

## Security Features

1. **Session Security**
   - httpOnly cookies
   - Secure flag in production
   - CSRF protection
   - Session expiration

2. **API Security**
   - Rate limiting per IP
   - Request size limits
   - Input validation
   - SQL injection prevention

3. **Token Management**
   - Tokens stored server-side only
   - Encrypted session storage
   - Automatic cleanup on logout

## WebSocket Events

### Client → Server
- `subscribe:groups` - Subscribe to group updates
- `subscribe:projects` - Subscribe to project updates
- `subscribe:jobs` - Subscribe to job updates

### Server → Client
- `group:created` - New group created
- `group:updated` - Group modified
- `group:deleted` - Group removed
- `project:*` - Project events
- `job:*` - Job status updates

## Error Handling

All errors follow a consistent format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "name",
      "reason": "Name is required"
    }
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

## Performance Considerations

- Connection pooling for GitLab API
- Response caching where appropriate
- Efficient session storage with Redis
- WebSocket connection management
- Request queuing for rate limits

## Deployment

For production deployment:
1. Set `NODE_ENV=production`
2. Use strong `SESSION_SECRET`
3. Configure Redis for sessions
4. Set up reverse proxy (nginx)
5. Enable HTTPS
6. Configure monitoring

See the [Deployment Guide](../docs/deployment/manual.md) for detailed instructions.

## Troubleshooting

Common issues:
- **Port already in use**: Change PORT in .env
- **CORS errors**: Check FRONTEND_URL setting
- **Session not persisting**: Verify SESSION_SECRET is set
- **Rate limit errors**: Increase RATE_LIMIT_MAX_REQUESTS

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT