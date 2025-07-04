import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/auth';
import LockIcon from '@mui/icons-material/Lock';

interface PermissionGuardProps {
  children: React.ReactNode;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showError?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permissions = [],
  requireAll = false,
  fallback,
  showError = true,
}) => {
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasRequiredPermissions = () => {
    if (permissions.length === 0) return true;
    if (permissions.length === 1) return hasPermission(permissions[0]);
    return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  };

  if (!hasRequiredPermissions()) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
            <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              권한이 없습니다
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              이 기능을 사용하려면 추가 권한이 필요합니다.
              관리자에게 문의하세요.
            </Typography>
            <Button variant="contained" onClick={() => navigate(-1)}>
              돌아가기
            </Button>
          </Paper>
        </Box>
      );
    }

    return null;
  }

  return <>{children}</>;
};

// 권한 기반 렌더링을 위한 헬퍼 컴포넌트
interface CanProps {
  permissions: Permission[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  permissions,
  requireAll = false,
  children,
  fallback = null,
}) => {
  return (
    <PermissionGuard
      permissions={permissions}
      requireAll={requireAll}
      fallback={fallback}
      showError={false}
    >
      {children}
    </PermissionGuard>
  );
};