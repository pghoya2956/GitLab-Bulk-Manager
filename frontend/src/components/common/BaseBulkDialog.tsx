/**
 * BaseBulkDialog - 모든 대량 작업 다이얼로그의 기본 컴포넌트
 * 공통 레이아웃, 상태 관리, 액션 버튼 제공
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
  Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';

export interface BaseBulkDialogProps {
  // 필수 props
  open: boolean;
  onClose: () => void;
  title: string;
  
  // 선택적 props
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disableEscapeKeyDown?: boolean;
  hideCloseButton?: boolean;
  dividers?: boolean;
  
  // 컨텐츠
  children: React.ReactNode;
  actions?: React.ReactNode;
  
  // 스타일
  contentSx?: object;
  actionsSx?: object;
  
  // 이벤트
  onEnter?: () => void;
  onExit?: () => void;
}

export const BaseBulkDialog: React.FC<BaseBulkDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'md',
  fullWidth = true,
  disableEscapeKeyDown = false,
  hideCloseButton = false,
  dividers = false,
  children,
  actions,
  contentSx = {},
  actionsSx = {},
  onEnter,
  onExit,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEscapeKeyDown={disableEscapeKeyDown}
      TransitionProps={{
        onEnter,
        onExit,
      }}
      sx={{
        '& .MuiDialog-paper': {
          position: 'relative',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {!hideCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
              disabled={disableEscapeKeyDown}
            >
              <Close />
            </IconButton>
          )}
        </Box>
      </DialogTitle>
      
      {dividers && <Divider />}
      
      <DialogContent sx={contentSx}>
        {children}
      </DialogContent>
      
      {actions && (
        <>
          {dividers && <Divider />}
          <DialogActions sx={actionsSx}>
            {actions}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

/**
 * 다이얼로그 섹션 컴포넌트
 */
export interface DialogSectionProps {
  title?: string;
  children: React.ReactNode;
  spacing?: number;
  divider?: boolean;
}

export const DialogSection: React.FC<DialogSectionProps> = ({
  title,
  children,
  spacing = 2,
  divider = false,
}) => {
  return (
    <Box sx={{ mb: spacing }}>
      {title && (
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
          {title}
        </Typography>
      )}
      {children}
      {divider && <Divider sx={{ mt: spacing }} />}
    </Box>
  );
};

/**
 * 다이얼로그 헤더 정보 컴포넌트
 */
export interface DialogInfoProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export const DialogInfo: React.FC<DialogInfoProps> = ({ label, value, icon }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      {icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>}
      <Typography variant="body2" color="text.secondary">
        {label}:
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
};

export default BaseBulkDialog;