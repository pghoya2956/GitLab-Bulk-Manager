# Backend Architecture

The GitLab Bulk Manager backend is built with Node.js and Express, serving as a secure proxy and business logic layer between the frontend and GitLab API.

## Architecture Overview

```
backend/
├── src/
│   ├── index.js              # Application entry point
│   ├── config/
│   │   ├── index.js          # Configuration loader
│   │   └── database.js       # Database configuration
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   ├── errorHandler.js   # Global error handling
│   │   ├── rateLimiter.js    # Rate limiting
│   │   └── validation.js     # Request validation
│   ├── routes/
│   │   ├── auth.js           # Authentication routes
│   │   ├── gitlab.js         # GitLab proxy routes
│   │   ├── jobs.js           # Job management routes
│   │   └── index.js          # Route aggregator
│   ├── services/
│   │   ├── gitlabProxy.js    # GitLab API proxy service
│   │   ├── jobQueue.js       # Background job processing
│   │   ├── sessionStore.js   # Session management
│   │   └── websocket.js      # WebSocket service
│   ├── utils/
│   │   ├── logger.js         # Winston logger
│   │   ├── validators.js     # Data validators
│   │   └── helpers.js        # Utility functions
│   └── types/
│       └── index.d.ts        # TypeScript definitions
├── tests/                    # Test files
├── .env.example              # Environment template
└── package.json              # Dependencies
```

## Core Components

### 1. Express Application Setup

```javascript
// src/index.js
const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### 2. GitLab Proxy Service

The proxy service handles all communication with GitLab API:

```javascript
// src/services/gitlabProxy.js
class GitLabProxy {
  constructor() {
    this.baseURL = 'https://gitlab.com/api/v4';
    this.rateLimiter = new RateLimiter({
      maxRequests: 10,
      perSeconds: 1
    });
  }

  async request(method, path, options = {}) {
    const { session, data, params } = options;
    
    // Rate limiting
    await this.rateLimiter.checkLimit(session.id);
    
    // Build request
    const config = {
      method,
      url: `${session.gitlabUrl}/api/v4${path}`,
      headers: {
        'PRIVATE-TOKEN': session.gitlabToken,
        'Content-Type': 'application/json'
      },
      params,
      data
    };
    
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw this.handleGitLabError(error);
    }
  }
  
  handleGitLabError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        throw new AuthError('GitLab authentication failed');
      }
      
      if (status === 429) {
        throw new RateLimitError('GitLab rate limit exceeded');
      }
      
      throw new GitLabAPIError(data.message || 'GitLab API error', status);
    }
    
    throw new NetworkError('Failed to connect to GitLab');
  }
}
```

### 3. Job Queue System

Background job processing for bulk operations:

```javascript
// src/services/jobQueue.js
class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.workers = [];
    this.maxConcurrent = 5;
  }
  
  async addJob(type, data, userId) {
    const job = {
      id: generateJobId(),
      type,
      data,
      userId,
      status: 'pending',
      progress: 0,
      total: data.items?.length || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.jobs.set(job.id, job);
    this.processNext();
    
    return job;
  }
  
  async processJob(job) {
    try {
      job.status = 'running';
      this.emit('job:started', job);
      
      switch (job.type) {
        case 'bulk_create_groups':
          await this.processBulkCreateGroups(job);
          break;
        case 'bulk_create_projects':
          await this.processBulkCreateProjects(job);
          break;
        // ... other job types
      }
      
      job.status = 'completed';
      this.emit('job:completed', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      this.emit('job:failed', job);
    }
  }
  
  async processBulkCreateGroups(job) {
    const { groups } = job.data;
    const results = [];
    
    for (let i = 0; i < groups.length; i++) {
      try {
        const group = await gitlabProxy.createGroup(groups[i]);
        results.push({ success: true, group });
        
        job.progress = i + 1;
        this.emit('job:progress', job);
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          item: groups[i]
        });
      }
    }
    
    job.results = results;
  }
}
```

### 4. WebSocket Service

Real-time communication with frontend:

```javascript
// src/services/websocket.js
class WebSocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
      }
    });
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }
  
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      const sessionId = socket.handshake.auth.sessionId;
      const session = await sessionStore.get(sessionId);
      
      if (!session || !session.user) {
        return next(new Error('Unauthorized'));
      }
      
      socket.userId = session.user.id;
      socket.sessionId = sessionId;
      next();
    });
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Join user's personal room
      socket.join(`user:${socket.userId}`);
      
      // Handle subscriptions
      socket.on('subscribe:groups', (data) => {
        const { groupIds } = data;
        groupIds.forEach(id => socket.join(`group:${id}`));
      });
      
      socket.on('subscribe:jobs', (data) => {
        const { jobIds } = data;
        jobIds.forEach(id => socket.join(`job:${id}`));
      });
      
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
      });
    });
  }
  
  // Emit events
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
  
  emitToGroup(groupId, event, data) {
    this.io.to(`group:${groupId}`).emit(event, data);
  }
  
  emitToJob(jobId, event, data) {
    this.io.to(`job:${jobId}`).emit(event, data);
  }
}
```

### 5. Middleware Architecture

#### Authentication Middleware
```javascript
// src/middleware/auth.js
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }
  
  req.user = req.session.user;
  next();
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
    next();
  };
};
```

#### Error Handler
```javascript
// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Determine status code
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  
  // Don't leak internal errors
  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred';
  }
  
  res.status(status).json({
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};
```

## Data Flow

### Request Lifecycle

```
1. HTTP Request → Express Router
2. Middleware Chain:
   - CORS validation
   - Rate limiting
   - Session parsing
   - Authentication check
   - Permission validation
   - Request validation
3. Route Handler
4. Service Layer:
   - Business logic
   - GitLab API calls
   - Database operations
5. Response formatting
6. WebSocket notifications (if applicable)
7. HTTP Response
```

### Session Management

```javascript
// Session data structure
{
  user: {
    id: 123,
    username: 'john.doe',
    email: 'john@example.com',
    role: 'developer',
    permissions: ['create_project', 'create_group']
  },
  gitlabUrl: 'https://gitlab.com',
  gitlabToken: 'encrypted-token-here',
  createdAt: '2024-01-01T10:00:00Z',
  lastActivity: '2024-01-01T10:30:00Z'
}
```

## Performance Considerations

### 1. Connection Pooling
```javascript
// HTTP agent with connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

axios.defaults.httpsAgent = httpsAgent;
```

### 2. Response Caching
```javascript
// Simple in-memory cache
class ResponseCache {
  constructor(ttl = 300) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl * 1000;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }
}
```

### 3. Request Queuing
```javascript
// Queue for GitLab API requests
class RequestQueue {
  constructor(concurrency = 10) {
    this.queue = [];
    this.running = 0;
    this.concurrency = concurrency;
  }
  
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const { fn, resolve, reject } = this.queue.shift();
    
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}
```

## Error Handling

### Error Types
```javascript
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class AuthError extends AppError {
  constructor(message) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class GitLabAPIError extends AppError {
  constructor(message, status) {
    super(message, status, 'GITLAB_API_ERROR');
  }
}
```

## Testing Strategy

### Unit Tests
```javascript
// tests/services/gitlabProxy.test.js
describe('GitLabProxy', () => {
  let proxy;
  
  beforeEach(() => {
    proxy = new GitLabProxy();
  });
  
  describe('request', () => {
    it('should add authentication header', async () => {
      const spy = jest.spyOn(axios, 'request');
      await proxy.request('GET', '/groups', {
        session: { gitlabToken: 'test-token' }
      });
      
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'PRIVATE-TOKEN': 'test-token'
          })
        })
      );
    });
  });
});
```

### Integration Tests
```javascript
// tests/routes/auth.test.js
describe('Auth Routes', () => {
  it('POST /api/auth/login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        gitlabUrl: 'https://gitlab.com',
        token: 'valid-token'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.headers['set-cookie']).toBeDefined();
  });
});
```

## Deployment Considerations

### Environment Variables
```bash
# Required
NODE_ENV=production
PORT=4000
SESSION_SECRET=strong-random-secret

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
MAX_REQUEST_SIZE=10mb
```

### Process Management
```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close database connections
  await redis.quit();
  
  // Wait for ongoing requests
  setTimeout(() => {
    process.exit(0);
  }, 10000);
});
```

### Health Checks
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    redis: redis.status === 'ready'
  });
});
```

## Next Steps

- Review [API Documentation](../api/README.md)
- Learn about [Security Architecture](./security.md)
- Set up [Development Environment](../development/backend-guide.md)
- Configure [Deployment](../deployment/manual.md)