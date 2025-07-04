import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Permission, ROLE_PERMISSIONS } from '../types/auth';

export const usePermissions = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.is_admin) return true;
    
    // Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    if (rolePermissions.includes(permission)) return true;
    
    // Check individual permissions
    return user.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canCreateGroup = () => hasPermission(Permission.GROUP_CREATE);
  const canUpdateGroup = () => hasPermission(Permission.GROUP_UPDATE);
  const canDeleteGroup = () => hasPermission(Permission.GROUP_DELETE);
  const canTransferGroup = () => hasPermission(Permission.GROUP_TRANSFER);
  
  const canCreateProject = () => hasPermission(Permission.PROJECT_CREATE);
  const canUpdateProject = () => hasPermission(Permission.PROJECT_UPDATE);
  const canDeleteProject = () => hasPermission(Permission.PROJECT_DELETE);
  const canTransferProject = () => hasPermission(Permission.PROJECT_TRANSFER);
  
  const canManageMembers = () => hasAnyPermission([
    Permission.MEMBER_ADD,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_UPDATE,
  ]);
  
  const canPerformBulkOperations = () => hasAnyPermission([
    Permission.BULK_IMPORT,
    Permission.BULK_EXPORT,
    Permission.BULK_DELETE,
  ]);
  
  const canAccessSystemSettings = () => hasAnyPermission([
    Permission.SYSTEM_BACKUP,
    Permission.SYSTEM_RESTORE,
    Permission.SYSTEM_MONITOR,
    Permission.SYSTEM_CONFIG,
  ]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canCreateGroup,
    canUpdateGroup,
    canDeleteGroup,
    canTransferGroup,
    canCreateProject,
    canUpdateProject,
    canDeleteProject,
    canTransferProject,
    canManageMembers,
    canPerformBulkOperations,
    canAccessSystemSettings,
    userRole: user?.role,
    isAdmin: user?.is_admin || false,
  };
};