/**
 * GitLab API Client
 * Handles all GitLab data fetching operations
 */

import axios from 'axios';
import { GitLabGroup, GitLabProject, GitLabUser } from '../types/gitlab';

// In production, use empty string for relative URLs
const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4050');

// Create axios instance for GitLab API
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/gitlab`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const gitlabAPI = {
  /**
   * Fetch all groups (paginated, returns all pages)
   */
  getGroups: async (): Promise<GitLabGroup[]> => {
    const allGroups: GitLabGroup[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await api.get<GitLabGroup[]>('/groups', {
        params: { per_page: perPage, page, all_available: true },
      });

      allGroups.push(...response.data);

      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-total-pages'] || '1', 10);
      if (page >= totalPages || response.data.length < perPage) {
        break;
      }
      page++;
    }

    return allGroups;
  },

  /**
   * Fetch all projects (paginated, returns all pages)
   */
  getProjects: async (): Promise<GitLabProject[]> => {
    const allProjects: GitLabProject[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await api.get<GitLabProject[]>('/projects', {
        params: { per_page: perPage, page, membership: true },
      });

      allProjects.push(...response.data);

      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-total-pages'] || '1', 10);
      if (page >= totalPages || response.data.length < perPage) {
        break;
      }
      page++;
    }

    return allProjects;
  },

  /**
   * Get subgroups of a group
   */
  getSubgroups: async (groupId: number): Promise<GitLabGroup[]> => {
    const response = await api.get<GitLabGroup[]>(`/groups/${groupId}/subgroups`, {
      params: { per_page: 100, all_available: true },
    });
    return response.data;
  },

  /**
   * Get projects in a group
   */
  getGroupProjects: async (groupId: number): Promise<GitLabProject[]> => {
    const response = await api.get<GitLabProject[]>(`/groups/${groupId}/projects`, {
      params: { per_page: 100, include_subgroups: false },
    });
    return response.data;
  },

  /**
   * Get current user
   */
  getCurrentUser: async (): Promise<GitLabUser> => {
    const response = await api.get<GitLabUser>('/user');
    return response.data;
  },

  /**
   * Get all users (for member management)
   */
  getUsers: async (search?: string): Promise<GitLabUser[]> => {
    const response = await api.get<GitLabUser[]>('/users', {
      params: { per_page: 100, search },
    });
    return response.data;
  },

  /**
   * Get a single group by ID
   */
  getGroup: async (groupId: number): Promise<GitLabGroup> => {
    const response = await api.get<GitLabGroup>(`/groups/${groupId}`);
    return response.data;
  },

  /**
   * Get a single project by ID
   */
  getProject: async (projectId: number): Promise<GitLabProject> => {
    const response = await api.get<GitLabProject>(`/projects/${projectId}`);
    return response.data;
  },
};

export default gitlabAPI;
