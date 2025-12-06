import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import dotenv from 'dotenv';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger.js';
import { sessionConfig } from './config/session.js';
import { corsConfig } from './config/cors.js';
import authRoutes from './routes/auth.js';
import gitlabRoutes from './routes/gitlab.js';
import bulkRoutes from './routes/bulk.js';
import statsRoutes from './routes/stats.js';
import permissionsRoutes from './routes/permissions.js';
import docsRoutes from './routes/docs.js';
import membersRoutes from './routes/members.js';
import healthRoutes from './routes/health.js';
import cicdRoutes from './routes/cicd.js';
import issuesRoutes from './routes/issues.js';
import { authenticateToken } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Trust proxy (for secure cookies behind reverse proxy/load balancer)
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  logger.info('Trust proxy enabled');
}

// Security middleware
app.use(helmet());
app.use(cors(corsConfig));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session(sessionConfig));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/docs', docsRoutes); // Documentation doesn't require auth
app.use('/api/stats', authenticateToken, statsRoutes);
app.use('/api/permissions', authenticateToken, permissionsRoutes);
app.use('/api/members', authenticateToken, membersRoutes);
app.use('/api/cicd', authenticateToken, cicdRoutes);
app.use('/api/issues', authenticateToken, issuesRoutes);
app.use('/api/gitlab/bulk', authenticateToken, bulkRoutes);
app.use('/api/gitlab', authenticateToken, gitlabRoutes);
app.use('/api/health', authenticateToken, healthRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4050;

httpServer.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

export { app };
