# Security Architecture

This document outlines the security architecture and best practices implemented in the GitLab Bulk Manager.

## Overview

Security is a top priority in GitLab Bulk Manager. The application implements defense-in-depth with multiple security layers to protect user data and prevent unauthorized access.

## Security Principles

1. **Principle of Least Privilege**: Users and processes have minimum necessary permissions
2. **Defense in Depth**: Multiple security layers protect against various attack vectors
3. **Secure by Default**: Security features enabled out of the box
4. **Zero Trust**: Never trust, always verify
5. **Data Minimization**: Store only necessary data

## Authentication Architecture

### Token Management

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Browser     │     │  Backend Server │     │   GitLab API    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         │  1. Login Request     │                         │
         │  (URL + PAT)          │                         │
         ├──────────────────────>│                         │
         │                       │  2. Validate Token       │
         │                       ├────────────────────────>│
         │                       │                         │
         │                       │  3. User Info           │
         │                       │<────────────────────────┤
         │                       │                         │
         │  4. Session Cookie    │                         │
         │  (httpOnly, secure)   │                         │
         │<──────────────────────┤                         │
         │                       │                         │
         │  5. API Request       │                         │
         │  (with session)       │                         │
         ├──────────────────────>│                         │
         │                       │  6. Attach Token        │
         │                       ├────────────────────────>│
         │                       │                         │
         │  7. Response          │  8. GitLab Response     │
         │<──────────────────────┤<────────────────────────┤
```

### Key Security Features

1. **Server-Side Token Storage**
   - GitLab PAT never sent to browser
   - Stored encrypted in server session
   - Automatic cleanup on logout

2. **Session Security**
   ```javascript
   app.use(session({
     secret: process.env.SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
     cookie: {
       secure: true,          // HTTPS only in production
       httpOnly: true,        // No JavaScript access
       sameSite: 'strict',    // CSRF protection
       maxAge: 86400000      // 24 hour expiration
     }
   }));
   ```

3. **CSRF Protection**
   - SameSite cookies
   - Origin validation
   - Referrer checking

## Authorization (RBAC)

### Role Hierarchy

```
Owner (50)
  └── Maintainer (40)
      └── Developer (30)
          └── Reporter (20)
              └── Guest (10)
```

### Permission Matrix

| Action | Guest | Reporter | Developer | Maintainer | Owner |
|--------|-------|----------|-----------|------------|-------|
| View Groups | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create Groups | ✗ | ✗ | ✓ | ✓ | ✓ |
| Update Groups | ✗ | ✗ | ✗ | ✓ | ✓ |
| Delete Groups | ✗ | ✗ | ✗ | ✗ | ✓ |
| View Projects | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create Projects | ✗ | ✓ | ✓ | ✓ | ✓ |
| Manage Members | ✗ | ✗ | ✗ | ✓ | ✓ |
| Bulk Operations | ✗ | ✗ | ✓ | ✓ | ✓ |

### Implementation

```typescript
// Frontend permission check
const PermissionGuard: React.FC<{ required: Permission }> = ({ required, children }) => {
  const { user } = useAuth();
  
  if (!hasPermission(user, required)) {
    return <AccessDenied />;
  }
  
  return <>{children}</>;
};

// Backend middleware
const requirePermission = (permission: Permission) => {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

## API Security

### Rate Limiting

```javascript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for whitelisted IPs
    return WHITELIST_IPS.includes(req.ip);
  }
});
```

### Input Validation

```typescript
// Validation middleware
const validateGroupCreate = [
  body('name').notEmpty().isLength({ max: 255 }),
  body('path').matches(/^[a-zA-Z0-9_-]+$/),
  body('visibility').isIn(['private', 'internal', 'public']),
  body('parent_id').optional().isInt(),
  handleValidationErrors
];

// SQL injection prevention (using parameterized queries)
const getGroup = async (id: number) => {
  return db.query('SELECT * FROM groups WHERE id = ?', [id]);
};
```

### Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Data Security

### Encryption

1. **In Transit**
   - HTTPS everywhere (TLS 1.2+)
   - Certificate pinning for GitLab API
   - Secure WebSocket (WSS)

2. **At Rest**
   - Session data encrypted
   - Sensitive configuration encrypted
   - No sensitive data in logs

### Data Handling

```typescript
// Sanitize user input
const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

// Redact sensitive data from logs
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
    redactSensitiveData()
  )
});

// Never log tokens or passwords
const redactSensitiveData = winston.format((info) => {
  if (info.token) info.token = '[REDACTED]';
  if (info.password) info.password = '[REDACTED]';
  return info;
});
```

## WebSocket Security

### Connection Authentication

```javascript
io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  
  sessionStore.get(sessionID, (err, session) => {
    if (err || !session || !session.user) {
      return next(new Error('Unauthorized'));
    }
    
    socket.user = session.user;
    next();
  });
});
```

### Event Validation

```javascript
socket.on('subscribe:groups', (data) => {
  // Validate user has access to requested groups
  const allowedGroups = data.groupIds.filter(id => 
    userHasAccessToGroup(socket.user, id)
  );
  
  socket.join(allowedGroups.map(id => `group:${id}`));
});
```

## Security Monitoring

### Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  userId: number;
  action: string;
  resource: string;
  resourceId: number;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: any;
}

const auditLog = (req: Request, action: string, resource: string, resourceId: number, success: boolean) => {
  const log: AuditLog = {
    timestamp: new Date(),
    userId: req.user?.id,
    action,
    resource,
    resourceId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    success
  };
  
  logger.audit(log);
};
```

### Security Alerts

- Failed login attempts
- Rate limit violations
- Authorization failures
- Suspicious patterns
- Invalid token usage

## Vulnerability Prevention

### OWASP Top 10 Mitigations

1. **Injection**: Parameterized queries, input validation
2. **Broken Authentication**: Secure sessions, token management
3. **Sensitive Data Exposure**: Encryption, minimal data storage
4. **XML External Entities**: JSON only, no XML parsing
5. **Broken Access Control**: RBAC, permission checks
6. **Security Misconfiguration**: Secure defaults, configuration validation
7. **Cross-Site Scripting**: CSP, output encoding, React's built-in protections
8. **Insecure Deserialization**: JSON schema validation
9. **Using Components with Known Vulnerabilities**: Regular dependency updates
10. **Insufficient Logging**: Comprehensive audit logging

### Regular Security Practices

1. **Dependency Scanning**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Code Scanning**
   - ESLint security plugin
   - Static analysis tools
   - Code reviews

3. **Penetration Testing**
   - Regular security assessments
   - Vulnerability scanning
   - Security headers testing

## Incident Response

### Security Incident Procedure

1. **Detection**: Monitoring alerts, user reports
2. **Containment**: Isolate affected systems
3. **Investigation**: Analyze logs, determine scope
4. **Remediation**: Fix vulnerability, patch systems
5. **Recovery**: Restore normal operations
6. **Post-Mortem**: Document lessons learned

### Emergency Contacts

- Security Team: security@example.com
- On-Call Engineer: +1-xxx-xxx-xxxx
- Incident Hotline: +1-xxx-xxx-xxxx

## Security Checklist

### Development
- [ ] Input validation on all user inputs
- [ ] Output encoding for all dynamic content
- [ ] Authentication checks on all endpoints
- [ ] Authorization checks for resource access
- [ ] Secure communication (HTTPS/WSS)
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information

### Deployment
- [ ] Strong session secrets
- [ ] HTTPS enabled with valid certificates
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery procedures
- [ ] Incident response plan documented

### Maintenance
- [ ] Regular dependency updates
- [ ] Security patch management
- [ ] Audit log review
- [ ] Access control review
- [ ] Security training for team
- [ ] Penetration testing schedule

## Compliance

### Standards
- OWASP Application Security Verification Standard (ASVS)
- CIS Security Controls
- NIST Cybersecurity Framework

### Privacy
- GDPR compliance for EU users
- Data minimization practices
- User consent for data processing
- Right to deletion support

## Resources

- [OWASP Security Guide](https://owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://react.dev/learn/security)
- [GitLab Security Documentation](https://docs.gitlab.com/ee/security/)