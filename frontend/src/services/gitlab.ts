import axios from 'axios';
import { store } from '../store';

const getGitLabClient = () => {
  // Use backend proxy instead of direct GitLab API
  return axios.create({
    baseURL: '/api/gitlab',
    withCredentials: true, // Include session cookies
  });
};

export const gitlabService = {
  // Permissions
  async getPermissionsOverview() {
    const response = await axios.get('/api/permissions/overview', { withCredentials: true });
    return response.data;
  },

  // Groups
  async getGroups(params?: { 
    page?: number; 
    per_page?: number; 
    search?: string;
    top_level_only?: boolean;
    parent_id?: number;
  }) {
    const client = getGitLabClient();
    const queryParams = { ...params };
    
    // Handle parent_id for subgroups
    if (params?.parent_id) {
      const response = await client.get(`/groups/${params.parent_id}/subgroups`, { 
        params: { per_page: params.per_page || 100 } 
      });
      return response.data;
    }
    
    const response = await client.get('/groups', { params: queryParams });
    return response.data;
  },

  async getGroup(id: number) {
    const client = getGitLabClient();
    const response = await client.get(`/groups/${id}`);
    return response.data;
  },

  async createGroup(data: { name: string; path: string; description?: string; visibility?: string; parent_id?: number }) {
    const client = getGitLabClient();
    const response = await client.post('/groups', data);
    return response.data;
  },

  async updateGroup(id: number, data: any) {
    const client = getGitLabClient();
    const response = await client.put(`/groups/${id}`, data);
    return response.data;
  },

  async deleteGroup(id: number) {
    const client = getGitLabClient();
    await client.delete(`/groups/${id}`);
  },

  async transferGroup(id: number, targetId: number) {
    const client = getGitLabClient();
    const response = await client.post(`/groups/${id}/transfer`, { group_id: targetId });
    return response.data;
  },

  // Projects
  async getProjects(params?: { page?: number; per_page?: number; search?: string }) {
    const client = getGitLabClient();
    const response = await client.get('/projects', { params });
    return response.data;
  },

  async getGroupProjects(groupId: number) {
    const client = getGitLabClient();
    const response = await client.get(`/groups/${groupId}/projects`);
    return response.data;
  },

  async createProject(data: { name: string; namespace_id: number; description?: string; visibility?: string }) {
    const client = getGitLabClient();
    const response = await client.post('/projects', data);
    return response.data;
  },

  async transferProject(id: number, namespaceId: number) {
    const client = getGitLabClient();
    const response = await client.put(`/projects/${id}/transfer`, { namespace: namespaceId });
    return response.data;
  },

  async deleteProject(id: number) {
    const client = getGitLabClient();
    await client.delete(`/projects/${id}`);
  },

  // Users
  async getUsers(params?: { page?: number; per_page?: number; search?: string }) {
    const client = getGitLabClient();
    const response = await client.get('/users', { params });
    return response.data;
  },

  async getCurrentUser() {
    const client = getGitLabClient();
    const response = await client.get('/user');
    return response.data;
  },

  // Members
  async addGroupMember(groupId: number, data: { user_id: number; access_level: number; expires_at?: string }) {
    const client = getGitLabClient();
    const response = await client.post(`/groups/${groupId}/members`, data);
    return response.data;
  },

  // Bulk Operations
  async bulkSetPushRules(projectIds: number[], rules: any) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/settings/push-rules', { projectIds, rules });
    return response.data;
  },

  async bulkSetProtectedBranches(projectIds: number[], branches: any) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/settings/protected-branches', { projectIds, branches });
    return response.data;
  },

  async bulkSetVisibility(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, visibility: string) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/settings/visibility', { items, visibility });
    return response.data;
  },

  async bulkSetAccessLevels(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, settings: any) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/settings/access-levels', { items, settings });
    return response.data;
  },

  async bulkDelete(items: Array<{ id: number; name: string; type: 'group' | 'project' }>) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/delete', { items });
    return response.data;
  },

  async bulkCreateSubgroups(parentId: number, subgroups: any[], defaults?: any, options?: any) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/subgroups', { parentId, subgroups, defaults, options });
    return response.data;
  },

  async bulkCreateProjects(projects: any[], defaults?: any, branchProtection?: any, ciVariables?: any) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/projects', { projects, defaults, branchProtection, ciVariables });
    return response.data;
  },

  async parseYaml(content: string) {
    const client = getGitLabClient();
    const response = await client.post('/bulk/parse-yaml', { content });
    return response.data;
  },
};