import logger from '../utils/logger.js';

const connectedClients = new Map();

let websocketService = null;

export const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Authenticate the socket connection
    socket.on('authenticate', (_token) => {
      // In production, validate the token against session
      connectedClients.set(socket.id, {
        socketId: socket.id,
        authenticated: true,
        subscribedJobs: new Set(),
        subscribedGroups: new Set(),
        subscribedProjects: new Set(),
      });

      socket.emit('authenticated', { success: true });
    });

    // Job subscriptions
    socket.on('job:subscribe', ({ jobId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedJobs.add(jobId);
        socket.join(`job:${jobId}`);
        logger.debug(`Client ${socket.id} subscribed to job ${jobId}`);
      }
    });

    socket.on('job:unsubscribe', ({ jobId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedJobs.delete(jobId);
        socket.leave(`job:${jobId}`);
      }
    });

    // Group subscriptions
    socket.on('group:subscribe', ({ groupId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedGroups.add(groupId);
        socket.join(`group:${groupId}`);
        logger.debug(`Client ${socket.id} subscribed to group ${groupId}`);
      }
    });

    socket.on('group:unsubscribe', ({ groupId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedGroups.delete(groupId);
        socket.leave(`group:${groupId}`);
      }
    });

    // Project subscriptions
    socket.on('project:subscribe', ({ projectId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedProjects.add(projectId);
        socket.join(`project:${projectId}`);
        logger.debug(`Client ${socket.id} subscribed to project ${projectId}`);
      }
    });

    socket.on('project:unsubscribe', ({ projectId }) => {
      const client = connectedClients.get(socket.id);
      if (client) {
        client.subscribedProjects.delete(projectId);
        socket.leave(`project:${projectId}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      connectedClients.delete(socket.id);
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  // Export methods for emitting events
  websocketService = {
    emitJobUpdate: (jobId, data) => {
      io.to(`job:${jobId}`).emit('job:update', data);
    },
    emitJobProgress: (jobId, progress) => {
      io.to(`job:${jobId}`).emit('job:progress', { id: jobId, progress });
    },
    emitJobCompleted: (jobId, result) => {
      io.to(`job:${jobId}`).emit('job:completed', { id: jobId, result });
    },
    emitJobFailed: (jobId, error) => {
      io.to(`job:${jobId}`).emit('job:failed', { id: jobId, error });
    },
    emitGroupUpdate: (groupId, data) => {
      io.to(`group:${groupId}`).emit('group:updated', data);
    },
    emitProjectUpdate: (projectId, data) => {
      io.to(`project:${projectId}`).emit('project:updated', data);
    },
    // SVN Migration events
    emitMigrationStarted: (migrationId, data) => {
      io.emit('migration:started', { id: migrationId, ...data });
    },
    emitMigrationProgress: (migrationId, progress) => {
      io.emit('migration:progress', { id: migrationId, ...progress });
    },
    emitMigrationLog: (migrationId, log) => {
      io.emit('migration:log', { id: migrationId, ...log });
    },
    emitMigrationCompleted: (migrationId, result) => {
      io.emit('migration:completed', { id: migrationId, ...result });
    },
    emitMigrationFailed: (migrationId, error) => {
      io.emit('migration:failed', { id: migrationId, ...error });
    },
    emitMigrationSyncing: (migrationId, data) => {
      io.emit('migration:syncing', { id: migrationId, ...data });
    },
    emitMigrationSynced: (migrationId, result) => {
      io.emit('migration:synced', { id: migrationId, ...result });
    },
    broadcast: (event, data) => {
      io.emit(event, data);
    },
  };
  
  return websocketService;
};

export default websocketService;