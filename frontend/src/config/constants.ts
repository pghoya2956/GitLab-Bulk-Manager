// Application constants and configuration

// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4050';
export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_COUNT = 3;
export const API_RETRY_DELAY = 1000; // 1 second

// WebSocket configuration
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4050';
export const WS_RECONNECT_DELAY = 5000; // 5 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Bulk operations
export const BULK_OPERATION_DELAY = 200; // milliseconds between requests
export const BULK_OPERATION_BATCH_SIZE = 10;

// UI constants
export const DRAWER_WIDTH = 280;
export const NOTIFICATION_DURATION = 5000; // 5 seconds
export const DEBOUNCE_DELAY = 300; // 300ms for search input

// Access levels
export const ACCESS_LEVELS = {
  NO_ACCESS: 0,
  MINIMAL_ACCESS: 5,
  GUEST: 10,
  REPORTER: 20,
  DEVELOPER: 30,
  MAINTAINER: 40,
  OWNER: 50,
} as const;

export const ACCESS_LEVEL_NAMES: Record<number, string> = {
  [ACCESS_LEVELS.NO_ACCESS]: 'No access',
  [ACCESS_LEVELS.MINIMAL_ACCESS]: 'Minimal access',
  [ACCESS_LEVELS.GUEST]: 'Guest',
  [ACCESS_LEVELS.REPORTER]: 'Reporter',
  [ACCESS_LEVELS.DEVELOPER]: 'Developer',
  [ACCESS_LEVELS.MAINTAINER]: 'Maintainer',
  [ACCESS_LEVELS.OWNER]: 'Owner',
};

// Visibility levels
export const VISIBILITY_LEVELS = {
  PRIVATE: 'private',
  INTERNAL: 'internal',
  PUBLIC: 'public',
} as const;

export const VISIBILITY_ICONS = {
  [VISIBILITY_LEVELS.PRIVATE]: 'lock',
  [VISIBILITY_LEVELS.INTERNAL]: 'shield',
  [VISIBILITY_LEVELS.PUBLIC]: 'public',
} as const;

// File size limits
export const MAX_YAML_SIZE = 1024 * 1024; // 1MB
export const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB

// Cache configuration
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
export const STALE_TIME = 60 * 1000; // 1 minute

// Route paths
export const ROUTES = {
  LOGIN: '/login',
  GROUPS_PROJECTS: '/',
  SYSTEM_HEALTH: '/health',
  DOCUMENTATION: '/docs',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  GENERIC: 'An error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Successfully logged in',
  LOGOUT: 'Successfully logged out',
  CREATE_GROUP: 'Group created successfully',
  CREATE_PROJECT: 'Project created successfully',
  UPDATE_SETTINGS: 'Settings updated successfully',
  BULK_OPERATION: 'Bulk operation completed successfully',
} as const;

// Supported languages
export const LANGUAGES = {
  en: 'English',
  ko: '한국어',
} as const;

// Default values
export const DEFAULTS = {
  VISIBILITY: VISIBILITY_LEVELS.PRIVATE,
  ACCESS_LEVEL: ACCESS_LEVELS.DEVELOPER,
  BRANCH_NAME: 'main',
} as const;