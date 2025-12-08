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
    const queryParams = {
      ...params
    };

    // Handle parent_id for subgroups
    if (params?.parent_id) {
      return gitLabClient.get<GitLabGroup[]>(`/groups/${params.parent_id}/subgroups`, {
        params: {
          per_page: params.per_page || 100
        }
      });
    }

    return gitLabClient.get<GitLabGroup[]>('/groups', { params: queryParams });
  },

  async getTopLevelGroups(): Promise<GitLabGroup[]> {
    return gitLabClient.get<GitLabGroup[]>('/groups', {
      params: {
        per_page: 100,
        top_level_only: true
      }
    });
  },

  async getSubgroups(parentId: number): Promise<GitLabGroup[]> {
    return gitLabClient.get<GitLabGroup[]>(`/groups/${parentId}/subgroups`, {
      params: {
        per_page: 100
      }
    });
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
    return gitLabClient.get<GitLabProject[]>('/projects', { 
      params: {
        ...params
      }
    });
  },

  async getGroupProjects(groupId: number): Promise<GitLabProject[]> {
    return gitLabClient.get<GitLabProject[]>(`/groups/${groupId}/projects`, {
      params: {
        per_page: 100,
        include_subgroups: false
      }
    });
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

  // Single item operations for sequential processing
  async archiveProject(id: number): Promise<GitLabProject> {
    return gitLabClient.post<GitLabProject>(`/projects/${id}/archive`);
  },

  async unarchiveProject(id: number): Promise<GitLabProject> {
    return gitLabClient.post<GitLabProject>(`/projects/${id}/unarchive`);
  },

  async cloneProject(id: number, suffix: string = '_copy'): Promise<GitLabProject> {
    // Get original project first
    const original = await gitLabClient.get<GitLabProject>(`/projects/${id}`);
    // Create new project with suffix
    const newPath = original.path + suffix.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return gitLabClient.post<GitLabProject>('/projects', {
      name: original.name + suffix,
      path: newPath,
      namespace_id: original.namespace.id,
      visibility: original.visibility,
      description: original.description,
    });
  },

  async cloneGroup(id: number, suffix: string = '_copy'): Promise<GitLabGroup> {
    // Get original group first
    const original = await gitLabClient.get<GitLabGroup>(`/groups/${id}`);
    // Create new group with suffix
    const newPath = original.path + suffix.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return gitLabClient.post<GitLabGroup>('/groups', {
      name: original.name + suffix,
      path: newPath,
      parent_id: original.parent_id,
      visibility: original.visibility,
      description: original.description,
    });
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

  async bulkSetProtectedBranches(
    projectIds: number[],
    branches: GitLabProtectedBranch[] | Array<{
      name: string;
      push_access_level: number;
      merge_access_level: number;
      unprotect_access_level?: number;
      allow_force_push?: boolean;
      code_owner_approval_required?: boolean;
    }>,
    deleteExisting: boolean = false
  ): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/protected-branches', {
      projectIds,
      branches: {
        deleteExisting,
        rules: branches
      }
    });
  },

  async bulkSetApprovalRules(
    projectIds: number[],
    rules: Array<{
      name: string;
      approvals_required: number;
      rule_type?: 'any_approver' | 'regular';
      applies_to_all_protected_branches?: boolean;
      user_ids?: number[];
      group_ids?: number[];
    }>,
    deleteExisting: boolean = false
  ): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/settings/approval-rules', {
      projectIds,
      rules,
      deleteExisting
    });
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

  async bulkTransfer(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, targetNamespaceId: number): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/transfer', { items, targetNamespaceId });
  },

  async bulkArchive(items: Array<{ id: number; name: string; type: 'group' | 'project' }>): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/archive', { items });
  },

  async bulkUnarchive(items: Array<{ id: number; name: string; type: 'group' | 'project' }>): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/unarchive', { items });
  },

  async bulkClone(items: Array<{ id: number; name: string; type: 'group' | 'project' }>, suffix?: string): Promise<BulkOperationResult> {
    return gitLabClient.post<BulkOperationResult>('/bulk/clone', { items, suffix });
  },

  async bulkCreateSubgroups(
    parentId: number, 
    subgroups: Array<{ name: string; path?: string; description?: string }>, 
    defaults?: Partial<GitLabGroup>, 
    options?: Record<string, unknown>
  ): Promise<{ success: boolean; results: BulkOperationResult; summary: any }> {
    return gitLabClient.post<{ success: boolean; results: BulkOperationResult; summary: any }>('/bulk/subgroups', { parentId, subgroups, defaults, options });
  },

  async bulkCreateProjects(
    projects: Array<{ group_id: number; projects: Array<{ name: string; path?: string; description?: string }> }>, 
    defaults?: Partial<GitLabProject>, 
    branchProtection?: GitLabProtectedBranch[], 
    ciVariables?: Array<{ key: string; value: string }>
  ): Promise<{ success: boolean; results: BulkOperationResult; summary: any }> {
    return gitLabClient.post<{ success: boolean; results: BulkOperationResult; summary: any }>('/bulk/projects', { projects, defaults, branchProtection, ciVariables });
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
  }
};