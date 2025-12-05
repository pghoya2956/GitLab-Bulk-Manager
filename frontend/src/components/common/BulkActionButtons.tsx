/**
 * BulkActionButtons - 대량 작업 액션 버튼 컴포넌트
 * 일관된 버튼 레이아웃 및 상태 관리
 */

import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Tooltip,
  CircularProgress,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import {
  Delete,
  Archive,
  Unarchive,
  ContentCopy,
  MoveUp,
  Download,
  Upload,
  MoreVert,
  Check,
  Close,
  Warning,
} from '@mui/icons-material';

export interface ActionButton {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  variant?: 'text' | 'outlined' | 'contained';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  badge?: number | string;
  onClick: () => void;
  confirm?: {
    title: string;
    message: string;
  };
}

export interface BulkActionButtonsProps {
  actions: ActionButton[];
  layout?: 'horizontal' | 'vertical' | 'grouped' | 'speed-dial';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  showLabels?: boolean;
  confirmOnDanger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  sx?: object;
}

export const BulkActionButtons: React.FC<BulkActionButtonsProps> = ({
  actions,
  layout = 'horizontal',
  size = 'medium',
  fullWidth = false,
  showLabels = true,
  disabled: globalDisabled = false,
  sx = {},
}) => {
  const renderButton = (action: ActionButton) => {
    const isDisabled = globalDisabled || action.disabled || action.loading;

    const button = (
      <Button
        key={action.id}
        variant={action.variant || 'outlined'}
        color={action.color || 'primary'}
        size={size}
        disabled={isDisabled}
        onClick={action.onClick}
        startIcon={!action.loading ? action.icon : undefined}
        fullWidth={fullWidth}
        sx={{ minWidth: showLabels ? 120 : 'auto' }}
      >
        {action.loading ? <CircularProgress size={20} /> : action.label}
      </Button>
    );

    if (action.tooltip && !isDisabled) {
      return (
        <Tooltip key={action.id} title={action.tooltip}>
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  // Horizontal layout
  if (layout === 'horizontal') {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ...sx }}>
        {actions.map(renderButton)}
      </Box>
    );
  }

  // Vertical layout
  if (layout === 'vertical') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ...sx }}>
        {actions.map(renderButton)}
      </Box>
    );
  }

  // Grouped layout
  if (layout === 'grouped') {
    const primaryActions = actions.filter(a => a.variant === 'contained');
    const secondaryActions = actions.filter(a => a.variant !== 'contained');

    return (
      <Box sx={{ display: 'flex', gap: 2, ...sx }}>
        {primaryActions.length > 0 && (
          <ButtonGroup variant="contained" size={size}>
            {primaryActions.map(action => (
              <Button
                key={action.id}
                color={action.color || 'primary'}
                disabled={globalDisabled || action.disabled || action.loading}
                onClick={action.onClick}
                startIcon={action.loading ? undefined : action.icon}
              >
                {action.loading ? <CircularProgress size={20} /> : action.label}
              </Button>
            ))}
          </ButtonGroup>
        )}
        {secondaryActions.length > 0 && (
          <ButtonGroup variant="outlined" size={size}>
            {secondaryActions.map(action => (
              <Button
                key={action.id}
                color={action.color || 'primary'}
                disabled={globalDisabled || action.disabled || action.loading}
                onClick={action.onClick}
                startIcon={action.loading ? undefined : action.icon}
              >
                {action.loading ? <CircularProgress size={20} /> : action.label}
              </Button>
            ))}
          </ButtonGroup>
        )}
      </Box>
    );
  }

  // Speed Dial layout
  if (layout === 'speed-dial') {
    return (
      <SpeedDial
        ariaLabel="Bulk Actions"
        sx={{ position: 'fixed', bottom: 16, right: 16, ...sx }}
        icon={<SpeedDialIcon />}
      >
        {actions.map(action => (
          <SpeedDialAction
            key={action.id}
            icon={action.icon || <MoreVert />}
            tooltipTitle={action.label}
            onClick={action.onClick}
            FabProps={{
              disabled: action.disabled || action.loading,
              color: action.color as any,
            }}
          />
        ))}
      </SpeedDial>
    );
  }

  return null;
};

/**
 * 사전 정의된 액션 버튼 세트
 */
export const PresetActions = {
  delete: (onClick: () => void, count?: number): ActionButton => ({
    id: 'delete',
    label: '삭제',
    icon: <Delete />,
    color: 'error',
    variant: 'contained',
    onClick,
    badge: count,
    tooltip: '선택한 항목을 삭제합니다',
  }),
  
  archive: (onClick: () => void, count?: number): ActionButton => ({
    id: 'archive',
    label: '보관',
    icon: <Archive />,
    color: 'warning',
    variant: 'outlined',
    onClick,
    badge: count,
    tooltip: '선택한 프로젝트를 보관합니다',
  }),
  
  unarchive: (onClick: () => void, count?: number): ActionButton => ({
    id: 'unarchive',
    label: '보관 해제',
    icon: <Unarchive />,
    color: 'success',
    variant: 'outlined',
    onClick,
    badge: count,
    tooltip: '선택한 프로젝트를 복원합니다',
  }),
  
  clone: (onClick: () => void, count?: number): ActionButton => ({
    id: 'clone',
    label: '복제',
    icon: <ContentCopy />,
    color: 'primary',
    variant: 'outlined',
    onClick,
    badge: count,
    tooltip: '선택한 항목을 복제합니다',
  }),
  
  transfer: (onClick: () => void, count?: number): ActionButton => ({
    id: 'transfer',
    label: '이동',
    icon: <MoveUp />,
    color: 'primary',
    variant: 'outlined',
    onClick,
    badge: count,
    tooltip: '다른 네임스페이스로 이동합니다',
  }),
  
  export: (onClick: () => void): ActionButton => ({
    id: 'export',
    label: '내보내기',
    icon: <Download />,
    color: 'primary',
    variant: 'outlined',
    onClick,
    tooltip: '데이터를 내보냅니다',
  }),
  
  import: (onClick: () => void): ActionButton => ({
    id: 'import',
    label: '가져오기',
    icon: <Upload />,
    color: 'primary',
    variant: 'outlined',
    onClick,
    tooltip: '데이터를 가져옵니다',
  }),
  
  cancel: (onClick: () => void): ActionButton => ({
    id: 'cancel',
    label: '취소',
    icon: <Close />,
    color: 'inherit',
    variant: 'text',
    onClick,
  }),
  
  confirm: (onClick: () => void): ActionButton => ({
    id: 'confirm',
    label: '확인',
    icon: <Check />,
    color: 'primary',
    variant: 'contained',
    onClick,
  }),
};

/**
 * 다이얼로그 액션 버튼
 */
export interface DialogActionButtonsProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  confirmIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  showWarning?: boolean;
}

export const DialogActionButtons: React.FC<DialogActionButtonsProps> = ({
  onCancel,
  onConfirm,
  cancelLabel = '취소',
  confirmLabel = '확인',
  confirmColor = 'primary',
  confirmIcon,
  loading = false,
  disabled = false,
  showWarning = false,
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <Button onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button
        onClick={onConfirm}
        color={confirmColor}
        variant="contained"
        disabled={disabled || loading}
        startIcon={loading ? undefined : (confirmIcon || (showWarning && <Warning />))}
      >
        {loading ? <CircularProgress size={20} /> : confirmLabel}
      </Button>
    </Box>
  );
};

export default BulkActionButtons;