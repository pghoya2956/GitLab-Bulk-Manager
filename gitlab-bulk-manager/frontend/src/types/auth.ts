export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at: string;
  role: UserRole;
  permissions: Permission[];
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export enum Permission {
  // Group permissions
  GROUP_CREATE = 'group:create',
  GROUP_READ = 'group:read',
  GROUP_UPDATE = 'group:update',
  GROUP_DELETE = 'group:delete',
  GROUP_TRANSFER = 'group:transfer',
  
  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_TRANSFER = 'project:transfer',
  
  // Member permissions
  MEMBER_ADD = 'member:add',
  MEMBER_REMOVE = 'member:remove',
  MEMBER_UPDATE = 'member:update',
  
  // Bulk operations
  BULK_IMPORT = 'bulk:import',
  BULK_EXPORT = 'bulk:export',
  BULK_DELETE = 'bulk:delete',
  
  // System permissions
  SYSTEM_BACKUP = 'system:backup',
  SYSTEM_RESTORE = 'system:restore',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_CONFIG = 'system:config',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MANAGER]: [
    Permission.GROUP_CREATE,
    Permission.GROUP_READ,
    Permission.GROUP_UPDATE,
    Permission.GROUP_TRANSFER,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_TRANSFER,
    Permission.MEMBER_ADD,
    Permission.MEMBER_UPDATE,
    Permission.BULK_IMPORT,
    Permission.BULK_EXPORT,
  ],
  [UserRole.DEVELOPER]: [
    Permission.GROUP_READ,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.MEMBER_ADD,
  ],
  [UserRole.VIEWER]: [
    Permission.GROUP_READ,
    Permission.PROJECT_READ,
  ],
};

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface GitLabAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  created_at: number;
}