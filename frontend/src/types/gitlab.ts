// GitLab API type definitions

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url: string;
  web_url: string;
  created_at: string;
  is_admin?: boolean;
  state: 'active' | 'blocked' | 'deactivated';
}

export interface GitLabGroup {
  id: number;
  name: string;
  path: string;
  description?: string;
  visibility: 'private' | 'internal' | 'public';
  share_with_group_lock: boolean;
  require_two_factor_authentication: boolean;
  two_factor_grace_period: number;
  project_creation_level: string;
  auto_devops_enabled: boolean | null;
  subgroup_creation_level: string;
  emails_disabled: boolean | null;
  mentions_disabled: boolean | null;
  lfs_enabled: boolean;
  default_branch_protection: number;
  avatar_url: string | null;
  web_url: string;
  request_access_enabled: boolean;
  full_name: string;
  full_path: string;
  file_template_project_id: number | null;
  parent_id: number | null;
  created_at: string;
  marked_for_deletion_on?: string | null;
  statistics?: GitLabGroupStatistics;
}

export interface GitLabGroupStatistics {
  storage_size: number;
  repository_size: number;
  wiki_size: number;
  lfs_objects_size: number;
  job_artifacts_size: number;
  packages_size: number;
  snippets_size: number;
  uploads_size: number;
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  description?: string;
  visibility: 'private' | 'internal' | 'public';
  path_with_namespace: string;
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
    full_path: string;
  };
  created_at: string;
  default_branch: string;
  http_url_to_repo: string;
  web_url: string;
  avatar_url: string | null;
  star_count: number;
  forks_count: number;
  open_issues_count: number;
  issues_enabled: boolean;
  merge_requests_enabled: boolean;
  wiki_enabled: boolean;
  jobs_enabled: boolean;
  snippets_enabled: boolean;
  container_registry_enabled: boolean;
  archived: boolean;
  statistics?: GitLabProjectStatistics;
}

export interface GitLabProjectStatistics {
  commit_count: number;
  storage_size: number;
  repository_size: number;
  wiki_size: number;
  lfs_objects_size: number;
  job_artifacts_size: number;
  packages_size: number;
  snippets_size: number;
  uploads_size: number;
}

export interface GitLabMember {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
  access_level: number;
  expires_at: string | null;
  created_at: string;
  created_by?: {
    id: number;
    username: string;
    name: string;
    state: string;
    avatar_url: string;
    web_url: string;
  };
}

export interface GitLabPermission {
  user_id: number;
  username: string;
  name: string;
  access_level: number;
  expires_at?: string;
}

export interface GitLabBranch {
  name: string;
  commit: {
    id: string;
    short_id: string;
    title: string;
    created_at: string;
    parent_ids: string[];
    message: string;
    author_name: string;
    author_email: string;
    authored_date: string;
    committer_name: string;
    committer_email: string;
    committed_date: string;
  };
  merged: boolean;
  protected: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
  can_push: boolean;
}

export interface GitLabProtectedBranch {
  id: number;
  name: string;
  push_access_levels: AccessLevel[];
  merge_access_levels: AccessLevel[];
  unprotect_access_levels: AccessLevel[];
  code_owner_approval_required: boolean;
  inherited: boolean;
}

export interface AccessLevel {
  access_level: number;
  access_level_description: string;
  user_id?: number;
  group_id?: number;
}

export interface GitLabPushRule {
  id: number;
  project_id: number;
  commit_message_regex?: string;
  commit_message_negative_regex?: string;
  branch_name_regex?: string;
  deny_delete_tag: boolean;
  member_check: boolean;
  prevent_secrets: boolean;
  author_email_regex?: string;
  file_name_regex?: string;
  max_file_size: number;
  commit_committer_check?: boolean;
  reject_unsigned_commits?: boolean;
}

// Alias for backward compatibility
export type GitLabPushRules = GitLabPushRule;

// Bulk operation types
export interface BulkOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  // Properties for bulk create operations
  created?: Array<{ id: number; name: string; path: string }>;
  failed?: Array<{ name: string; error: string }>;
  skipped?: Array<{ name: string; reason: string }>;
  // Properties for bulk settings operations
  // Note: Backend returns 'success' array, not 'successful'
  results?: {
    success: Array<{ id: number; name: string; type?: string }>;
    successful?: Array<{ id: number; name: string }>; // Alias for compatibility
    failed: Array<{ id: number; name: string; error: string; type?: string }>;
    created?: Array<{ id: number; name: string; path: string }>;
    skipped?: Array<{ name: string; reason: string }>;
    total?: number;
  };
  summary?: {
    total: number;
    success: number;
    failed: number;
    created?: number;
    skipped?: number;
  };
}

export interface BulkCreateGroup {
  name: string;
  path: string;
  parent_id?: number;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  subgroups?: BulkCreateGroup[];
  projects?: BulkCreateProject[];
}

export interface BulkCreateProject {
  name: string;
  path?: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
}

export interface BulkVisibilityUpdate {
  id: number;
  type: 'group' | 'project';
  visibility: 'private' | 'internal' | 'public';
}

export interface BulkProtectedBranchUpdate {
  id: number;
  type: 'project';
  branch: string;
  push_access_level: number;
  merge_access_level: number;
}

export interface BulkPushRuleUpdate {
  id: number;
  type: 'project';
  rules: Partial<GitLabPushRule>;
}

export interface BulkAccessLevelUpdate {
  id: number;
  type: 'group' | 'project';
  user_id: number;
  access_level: number;
}

// Tree node types for UI
export interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  children?: TreeNode[];
  expanded?: boolean;
  selected?: boolean;
  data?: GitLabGroup | GitLabProject;
  memberCount?: number;
  accessLevel?: string;
  visibility?: 'private' | 'internal' | 'public';
}

// Permission overview types
export interface PermissionOverview {
  groups: GroupPermission[];
  totalUsers: number;
}

export interface GroupPermission {
  id: number;
  name: string;
  full_path: string;
  members: GitLabMember[];
  subgroups?: GroupPermission[];
}

// Error types
export interface GitLabError {
  error?: string;
  message?: string;
  error_description?: string;
}

// Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Stats types
export interface SystemStats {
  groups: StatsData;
  projects: StatsData;
  users: StatsData;
}

export interface StatsData {
  count: number;
  loading: boolean;
  error?: string;
}

// Auth types
export interface AuthState {
  isAuthenticated: boolean;
  user?: GitLabUser;
  gitlabUrl?: string;
  loading: boolean;
  error?: string;
}

// Form types
export interface CreateGroupFormData {
  name: string;
  path: string;
  description?: string;
  visibility: 'private' | 'internal' | 'public';
}

export interface CreateProjectFormData {
  name: string;
  path?: string;
  description?: string;
  visibility: 'private' | 'internal' | 'public';
  initialize_with_readme?: boolean;
}