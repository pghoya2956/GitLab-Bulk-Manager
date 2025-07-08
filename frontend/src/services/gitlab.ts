import axios from 'axios';
import { gitLabClient } from './gitlabClient';
import type { 
  GitLabGroup, 
  GitLabProject,
  GitLabPushRule,
  GitLabProtectedBranch,
  BulkOperationResult
} from '../types/gitlab';

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
  }): Promise<GitLabGroup[]> {
    const queryParams = { ...params };
    
    // Handle parent_id for subgroups
    if (params?.parent_id) {
      return gitLabClient.get<GitLabGroup[]>(`/groups/${params.parent_id}/subgroups`, { 
        params: { per_page: params.per_page || 100 } 
      });
    }
    
    return gitLabClient.get<GitLabGroup[]>('/groups', { params: queryParams });
  },

  async getGroup(id: number): Promise<GitLabGroup> {
    return gitLabClient.get<GitLabGroup>(`/groups/${id}`);
  },

  async createGroup(data: { 
    name: string; 
    path: string; 
    description?: string; 
    visibility?: string; 
    parent_id?: number 
  }): Promise<GitLabGroup> {
    return gitLabClient.post<GitLabGroup>('/groups', data);
  },

  async updateGroup(id: number, data: Partial<GitLabGroup>): Promise<GitLabGroup> {
    return gitLabClient.put<GitLabGroup>(`/groups/${id}`, data);
  },

  async deleteGroup(id: number): Promise<void> {
    return gitLabClient.delete(`/groups/${id}`);
  },

  async transferGroup(id: number, targetId: number): Promise<GitLabGroup> {
    return gitLabClient.post<GitLabGroup>(`/groups/${id}/transfer`, { group_id: targetId });
  },

  // Projects
  async getProjects(params?: { page?: number; per_page?: number; search?: string }): Promise<GitLabProject[]> {
    return gitLabClient.get<GitLabProject[]>('/projects', { params });
  },

  async getGroupProjects(groupId: number): Promise<GitLabProject[]> {
    return gitLabClient.get<GitLabProject[]>(`/groups/${groupId}/projects`);
  },

  async createProject(data: { 
    name: string; 
    namespace_id: number; 
    description?: string; 
    visibility?: string 
  }): Promise<GitLabProject> {
    return gitLabClient.post<GitLabProject>('/projects', data);
  },

  async transferProject(id: number, namespaceId: number): Promise<GitLabProject> {
    return gitLabClient.put<GitLabProject>(`/projects/${id}/transfer`, { namespace: namespaceId });
  },

  async deleteProject(id: number): Promise<void> {
    return gitLabClient.delete(`/projects/${id}`);
  },

  // Users
  async getUsers(params?: { page?: number; per_page?: number; search?: string }) {
    return gitLabClient.get('/users', { params });
  },

  async getCurrentUser() {
    return gitLabClient.get('/user');
  },

  // Members
  async addGroupMember(groupId: number, data: { user_id: number; access_level: number; expires_at?: string }) {
    return gitLabClient.post(`/groups/${groupId}/members`, data);
  },

  // Bulk Operations
  async bulkSetPushRules(projectIds: number[], rules: Partial<GitLabPushRule>): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/push-rules', { projectIds, rules });
  },

  async bulkSetProtectedBranches(projectIds: number[], branches: GitLabProtectedBranch[]): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/protected-branches', { projectIds, branches });
  },

  async bulkSetVisibility(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, visibility: string): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/visibility', { items, visibility });
  },

  async bulkSetAccessLevels(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, settings: Record<string, unknown>): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/access-levels', { items, settings });
  },

  async bulkDelete(items: Array<{ id: number; name: string; type: 'group' | 'project' }>): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/delete', { items });
  },

  async bulkCreateSubgroups(
    parentId: number, 
    subgroups: Array<{ name: string; path?: string; description?: string }>, 
    defaults?: Partial<GitLabGroup>, 
    options?: Record<string, unknown>
  ): Promise<{ results: BulkOperationResult }> {
    return gitLabClient.post<{ results: BulkOperationResult }>('/bulk/subgroups', { parentId, subgroups, defaults, options });
  },

  async bulkCreateProjects(
    projects: Array<{ group_id: number; projects: Array<{ name: string; path?: string; description?: string }> }>, 
    defaults?: Partial<GitLabProject>, 
    branchProtection?: GitLabProtectedBranch[], 
    ciVariables?: Array<{ key: string; value: string }>
  ): Promise<{ results: BulkOperationResult }> {
    return gitLabClient.post<{ results: BulkOperationResult }>('/bulk/projects', { projects, defaults, branchProtection, ciVariables });
  },

  async parseYaml(content: string): Promise<{
    subgroups?: Array<{ name: string; path?: string; description?: string }>;
    projects?: Array<{ name: string; path?: string; description?: string }>;
    defaults?: Record<string, unknown>;
    options?: Record<string, unknown>;
    branchProtection?: Record<string, unknown>;
    ciVariables?: Array<{ key: string; value: string }>;
  }> {
    return gitLabClient.post('/bulk/parse-yaml', { content });
  },

  // SVN Migration
  async testSvnConnection(data: {
    svnUrl: string;
    svnUsername: string;
    svnPassword: string;
  }) {
    const response = await axios.post('/api/svn/test-connection', data, { withCredentials: true });
    return response.data.data;
  },

  async extractSvnUsers(svnUrl: string) {
    const response = await axios.get('/api/svn/extract-users', {
      params: { svnUrl },
      withCredentials: true
    });
    return response.data.data;
  },

  async previewSvnMigration(data: {
    svnUrl: string;
    layout: any;
    authorsMapping: Record<string, string>;
  }) {
    const response = await axios.post('/api/svn/preview', data, { withCredentials: true });
    return response.data.data;
  },

  async startSvnMigration(data: {
    svnUrl: string;
    gitlabProjectId: number;
    projectName: string;
    projectPath: string;
    layout: any;
    authorsMapping: Record<string, string>;
    options?: any;
    autoStart?: boolean;
  }) {
    console.log('gitlabService.startSvnMigration sending:', {
      projectName: data.projectName,
      projectPath: data.projectPath,
      fullData: data
    });
    const response = await axios.post('/api/svn/migrate', {
      ...data,
      autoStart: data.autoStart !== undefined ? data.autoStart : false  // 기본값 false
    }, { withCredentials: true });
    return response.data.data;
  },

  async startBulkSvnMigration(migrations: any[]) {
    const response = await axios.post('/api/svn/migrate/bulk', { migrations }, { withCredentials: true });
    return response.data.data;
  },

  async getSvnMigrations() {
    const response = await axios.get('/api/svn/migrations', { withCredentials: true });
    return response.data.data;
  },

  async getSvnMigrationById(id: string) {
    const response = await axios.get(`/api/svn/migrations/${id}`, { withCredentials: true });
    return response.data.data;
  },

  async syncSvnMigration(id: string) {
    const response = await axios.post(`/api/svn/migrations/${id}/sync`, {}, { withCredentials: true });
    return response.data.data;
  },

  async deleteSvnMigration(id: string) {
    const response = await axios.delete(`/api/svn/migrations/${id}`, { withCredentials: true });
    return response.data;
  },

  async parseSvnYaml(content: string) {
    const response = await axios.post('/api/svn/parse-yaml', { content }, { withCredentials: true });
    return response.data.data;
  },

  // Job Queue
  async getJobQueueStatus() {
    const response = await axios.get('/api/svn/queue/status', { withCredentials: true });
    return response.data.data;
  },

  async cleanFailedJobs() {
    const response = await axios.post('/api/svn/queue/clean-failed', {}, { withCredentials: true });
    return response.data.data;
  },

  async retryJob(jobId: string, queueType: 'migration' | 'sync' = 'migration') {
    const response = await axios.post(`/api/svn/queue/retry/${jobId}`, { queueType }, { withCredentials: true });
    return response.data.data;
  },

  // Alias methods for MigrationMonitor
  async getMigrations() {
    return this.getSvnMigrations();
  },

  async deleteMigration(id: string) {
    return this.deleteSvnMigration(id);
  },

  async syncMigration(id: string) {
    return this.syncSvnMigration(id);
  },

  async cleanMigrations(options: { migrationIds?: string[], includeCompleted?: boolean, includeFailed?: boolean }) {
    const response = await axios.post('/api/svn/migrations/clean', options, { withCredentials: true });
    return response.data.data;
  },

  async stopMigration(id: string) {
    const response = await axios.post(`/api/svn/migrations/${id}/stop`, {}, { withCredentials: true });
    return response.data.data;
  },

  async resumeMigration(id: string, data: { resumeFrom: 'lastRevision' | 'beginning', svnUsername?: string, svnPassword?: string }) {
    const response = await axios.post(`/api/svn/migrations/${id}/resume`, data, { withCredentials: true });
    return response.data.data;
  },

  async getMigrationById(id: string) {
    return this.getSvnMigrationById(id);
  },

  // 새로운 메소드들
  async startMigrations(migrationIds: string[]) {
    const response = await axios.post('/api/svn/migrate/start', { migrationIds }, { withCredentials: true });
    return response.data.data;
  },

  async setConcurrentLimit(limit: number) {
    const response = await axios.put('/api/svn/settings/concurrent-limit', { limit }, { withCredentials: true });
    return response.data.data;
  },

  async getConcurrentLimit() {
    const response = await axios.get('/api/svn/settings/concurrent-limit', { withCredentials: true });
    return response.data.data;
  }
};