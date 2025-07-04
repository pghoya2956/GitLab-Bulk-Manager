# Architecture Overview

GitLab Bulk Manager is designed as a modern, scalable web application for managing GitLab resources at scale. This document provides a high-level overview of the system architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React SPA (Port 3000)                                   │   │
│  │  - Material-UI Components                                │   │
│  │  - Redux State Management                                │   │
│  │  - React Router Navigation                               │   │
│  │  - WebSocket Client                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API Server                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Express.js Server (Port 4000)                          │   │
│  │  - Session-based Authentication                         │   │
│  │  - GitLab API Proxy                                     │   │
│  │  - WebSocket Server                                     │   │
│  │  - Job Queue System                                     │   │
│  │  - Rate Limiting                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitLab Instance                             │
│  - REST API v4                                                  │
│  - Groups, Projects, Members                                    │
│  - Issues, MRs, Wikis                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend (React SPA)

The frontend is a single-page application built with:
- **React 18**: Modern UI library with hooks and concurrent features
- **TypeScript**: Type-safe development
- **Material-UI**: Comprehensive component library
- **Redux Toolkit**: Predictable state management
- **RTK Query**: Powerful data fetching and caching
- **React Router v6**: Client-side routing
- **Socket.io Client**: Real-time communication

### 2. Backend (Express Server)

The backend serves as a secure proxy and business logic layer:
- **Express.js**: Fast, unopinionated web framework
- **Session Management**: Secure token storage
- **GitLab Proxy**: Handles all GitLab API communication
- **WebSocket Server**: Real-time updates
- **Job Queue**: Asynchronous task processing
- **Rate Limiting**: API protection

### 3. Data Flow

```
User Action → React Component → Redux Action → API Call
                                                   │
                                                   ▼
                                            Backend Proxy
                                                   │
                                                   ▼
                                            GitLab API
                                                   │
                                                   ▼
                                            Response Processing
                                                   │
                                                   ▼
                                Redux Store Update → UI Update
```

## Key Architectural Decisions

### 1. Backend Proxy Pattern

**Decision**: Route all GitLab API calls through a backend proxy

**Rationale**:
- Avoids CORS issues with direct browser-to-GitLab calls
- Centralizes authentication and token management
- Enables request/response transformation
- Provides security layer and rate limiting
- Allows for caching and optimization

### 2. Session-Based Authentication

**Decision**: Store GitLab tokens in server sessions, not browser

**Rationale**:
- Enhanced security - tokens never exposed to client
- Protection against XSS attacks
- Centralized session management
- Easy revocation and timeout handling

### 3. Real-time Updates via WebSocket

**Decision**: Implement WebSocket for live updates

**Rationale**:
- Immediate feedback for long-running operations
- Reduced polling overhead
- Better user experience
- Efficient resource utilization

### 4. Component-Based Architecture

**Decision**: Organize code into reusable React components

**Rationale**:
- Maintainable and testable code
- Consistent UI/UX
- Faster development
- Easy to extend and modify

### 5. TypeScript Throughout

**Decision**: Use TypeScript for both frontend and backend

**Rationale**:
- Type safety catches errors early
- Better IDE support and autocomplete
- Self-documenting code
- Easier refactoring

## Scalability Considerations

### Horizontal Scaling

The architecture supports horizontal scaling:
- Stateless backend servers (with Redis session store)
- Load balancer distribution
- WebSocket sticky sessions
- Distributed job processing

### Performance Optimizations

- **Frontend**: Code splitting, lazy loading, memoization
- **Backend**: Response caching, connection pooling
- **API**: Pagination, selective field retrieval
- **Real-time**: Subscription-based updates

### Security Layers

1. **Authentication**: Session-based with httpOnly cookies
2. **Authorization**: Role-based access control (RBAC)
3. **API Security**: Rate limiting, input validation
4. **Transport**: HTTPS everywhere
5. **Data**: Encryption at rest and in transit

## Technology Stack

### Frontend
- React 18.2.0
- TypeScript 5.0+
- Material-UI 5.x
- Redux Toolkit 2.x
- React Router 6.x
- Axios
- Socket.io Client

### Backend
- Node.js 18 LTS
- Express 4.x
- TypeScript 5.0+
- Socket.io
- Express Session
- Redis (optional)
- Winston (logging)

### Development Tools
- Vite (frontend bundler)
- Jest (testing)
- Playwright (E2E testing)
- ESLint & Prettier
- Docker (containerization)

## Design Principles

### 1. Separation of Concerns
- Clear boundaries between layers
- Single responsibility components
- Modular architecture

### 2. Security First
- Defense in depth
- Principle of least privilege
- Secure by default

### 3. User Experience
- Responsive design
- Real-time feedback
- Intuitive navigation
- Error recovery

### 4. Developer Experience
- Clear code structure
- Comprehensive documentation
- Easy local development
- Automated testing

## Integration Points

### GitLab API
- REST API v4
- Pagination support
- Error handling
- Rate limit respect

### External Services (Optional)
- Redis for sessions
- Monitoring services
- Log aggregation
- Error tracking

## Next Steps

- Deep dive into [Frontend Architecture](./frontend.md)
- Understand [Backend Architecture](./backend.md)
- Review [Security Architecture](./security.md)
- Learn about [API Design](../api/README.md)