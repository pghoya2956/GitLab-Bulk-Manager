// Application constants and configuration

// API Rate Limiting
export const API_RATE_LIMIT = {
  DEFAULT_DELAY: parseInt(process.env.API_RATE_LIMIT_DELAY) || 200, // milliseconds between requests
  MAX_RETRIES: parseInt(process.env.API_MAX_RETRIES) || 3,
  BACKOFF_MULTIPLIER: 2, // Exponential backoff multiplier
};

// Server Configuration
export const SERVER_CONFIG = {
  PORT: parseInt(process.env.PORT) || 4000,
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key-here',
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
};

// GitLab API Configuration
export const GITLAB_CONFIG = {
  DEFAULT_URL: process.env.GITLAB_API_URL || 'https://gitlab.com',
  API_VERSION: '/api/v4',
  DEFAULT_PER_PAGE: 100,
};

// CORS Configuration
export const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  PING_INTERVAL: 30000, // 30 seconds
  PING_TIMEOUT: 5000, // 5 seconds
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
};