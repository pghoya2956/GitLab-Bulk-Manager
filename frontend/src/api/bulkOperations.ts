import axios from 'axios';
import { getAuthToken } from './auth';

// In production, use empty string for relative URLs
const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4050');

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/gitlab/bulk`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const bulkAPI = {
  // Delete operations
  bulkDelete: (items: any[]) => {
    return api.post('/delete', { items });
  },

  // Transfer operations
  bulkTransfer: (items: any[], targetNamespaceId: string | number) => {
    return api.post('/transfer', { items, targetNamespaceId });
  },

  // Archive operations
  bulkArchive: (items: any[]) => {
    return api.post('/archive', { items });
  },

  bulkUnarchive: (items: any[]) => {
    return api.post('/unarchive', { items });
  },

  // Clone operations
  bulkClone: (items: any[], suffix?: string) => {
    return api.post('/clone', { items, suffix });
  },

  // Create operations
  createSubgroups: (parentId: string | number, subgroups: any[], options?: any) => {
    return api.post('/subgroups', { parentId, subgroups, ...options });
  },

  createProjects: (projects: any[], options?: any) => {
    return api.post('/projects', { projects, ...options });
  },

  // Settings operations
  updateVisibility: (items: any[], visibility: string) => {
    return api.post('/settings/visibility', { items, visibility });
  },

  updateAccessLevels: (items: any[], settings: any) => {
    return api.post('/settings/access-levels', { items, settings });
  },

  updateProtectedBranches: (projectIds: any[], branches: any) => {
    return api.post('/settings/protected-branches', { projectIds, branches });
  },

  updatePushRules: (projectIds: any[], rules: any) => {
    return api.post('/settings/push-rules', { projectIds, rules });
  },

  // Health check
  healthCheck: () => {
    return api.get('/health-check');
  },

  // Parse YAML
  parseYaml: (content: string) => {
    return api.post('/parse-yaml', { content });
  },
};

export default bulkAPI;