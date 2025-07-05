import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger.js';
import { sessionConfig } from './config/session.js';
import { corsConfig } from './config/cors.js';
import authRoutes from './routes/auth.js';
import gitlabRoutes from './routes/gitlab.js';
import bulkRoutes from './routes/bulk.js';
import testRoutes from './routes/test.js';
import statsRoutes from './routes/stats.js';
import permissionsRoutes from './routes/permissions.js';
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupWebSocket } from './services/websocket.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsConfig
});

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
app.use('/api/stats', authenticateToken, statsRoutes);
app.use('/api/permissions', authenticateToken, permissionsRoutes);
app.use('/api/gitlab/bulk', authenticateToken, bulkRoutes);
app.use('/api/gitlab', authenticateToken, gitlabRoutes);
app.use('/api', testRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(io);

// Start server
const PORT = process.env.PORT || 4000;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);
  logger.info(`WebSocket server integrated on same port`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

export { app, io };