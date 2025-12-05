/**
 * BulkProgressDialog
 * 대량 작업 진행 상황을 항목별로 표시하는 다이얼로그
 *
 * 특징:
 * - 각 항목의 상태 (대기/처리중/완료/실패) 실시간 표시
 * - 전체 진행률 표시
 * - 취소/일시정지/재개 기능
 * - 완료 후 결과 요약
 */

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  RadioButtonUnchecked,
  Loop,
  Cancel,
  Pause,
  PlayArrow,
  Folder,
  Description,
  ExpandMore,
  ExpandLess,
  Close,
} from '@mui/icons-material';
import type { ProcessingItem, ItemStatus } from '../../hooks/useSequentialBulkOperation';

export interface BulkProgressDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;

  // 진행 상태
  items: ProcessingItem[];
  currentIndex: number;
  progress: number;
  completed: number;
  failed: number;
  total: number;

  // 상태
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  startTime: Date | null;

  // 액션
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;

  // 완료 후
  onComplete?: () => void;

  // 스타일
  maxVisibleItems?: number;
}

const StatusIcon: React.FC<{ status: ItemStatus }> = ({ status }) => {
  switch (status) {
    case 'success':
      return <CheckCircle color="success" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'processing':
      return <Loop color="primary" sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />;
    case 'cancelled':
      return <Cancel color="disabled" />;
    default:
      return <RadioButtonUnchecked color="disabled" />;
  }
};

const StatusChip: React.FC<{ status: ItemStatus; error?: string }> = ({ status, error }) => {
  const config = {
    pending: { label: '대기', color: 'default' as const },
    processing: { label: '처리 중', color: 'primary' as const },
    success: { label: '완료', color: 'success' as const },
    error: { label: error || '실패', color: 'error' as const },
    cancelled: { label: '취소됨', color: 'default' as const },
  };

  const { label, color } = config[status];

  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant={status === 'processing' ? 'filled' : 'outlined'}
    />
  );
};

export const BulkProgressDialog: React.FC<BulkProgressDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  items,
  currentIndex: _currentIndex, // Used for tracking, not directly in render
  progress,
  completed,
  failed,
  total,
  isRunning,
  isPaused,
  isCancelled,
  startTime,
  onCancel,
  onPause,
  onResume,
  onComplete,
  maxVisibleItems = 10,
}) => {
  const [showAllItems, setShowAllItems] = React.useState(false);

  // 경과 시간 계산
  const [elapsedTime, setElapsedTime] = React.useState(0);

  React.useEffect(() => {
    if (!startTime || !isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isRunning]);

  // 시간 포맷
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  // 표시할 항목
  const visibleItems = useMemo(() => {
    if (showAllItems || items.length <= maxVisibleItems) {
      return items;
    }
    return items.slice(0, maxVisibleItems);
  }, [items, showAllItems, maxVisibleItems]);

  // 완료 여부
  const isComplete = !isRunning && progress === 100;
  const hasHiddenItems = items.length > maxVisibleItems && !showAllItems;

  // 닫기 핸들러
  const handleClose = () => {
    if (isRunning && !isCancelled) {
      // 작업 중에는 닫기 불가 (취소 먼저 해야 함)
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isRunning}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {!isRunning && (
            <IconButton onClick={handleClose} size="small">
              <Close />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 진행률 바 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              진행률: {completed + failed} / {total}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {elapsedTime > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {formatTime(elapsedTime)}
                </Typography>
              )}
              <Chip
                label={`${Math.round(progress)}%`}
                size="small"
                color={isComplete ? (failed > 0 ? 'warning' : 'success') : 'primary'}
              />
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={isComplete ? (failed > 0 ? 'warning' : 'success') : 'primary'}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* 일시정지 상태 알림 */}
        {isPaused && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            작업이 일시정지되었습니다. 계속하려면 재개 버튼을 클릭하세요.
          </Alert>
        )}

        {/* 취소됨 알림 */}
        {isCancelled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            작업이 취소되었습니다. {completed}개 완료, {total - completed - failed}개 취소됨
          </Alert>
        )}

        {/* 항목 목록 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          처리 항목
        </Typography>
        <List dense sx={{ bgcolor: 'background.default', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
          {visibleItems.map((item) => (
            <ListItem
              key={`${item.type}-${item.id}`}
              sx={{
                bgcolor: item.status === 'processing' ? 'action.selected' : 'transparent',
                borderRadius: 1,
                mb: 0.5,
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <StatusIcon status={item.status} />
              </ListItemIcon>
              <ListItemIcon sx={{ minWidth: 32 }}>
                {item.type === 'group' ? (
                  <Folder fontSize="small" color="action" />
                ) : (
                  <Description fontSize="small" color="action" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.name}
                secondary={item.full_path}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <StatusChip status={item.status} error={item.error} />
            </ListItem>
          ))}
        </List>

        {/* 더 보기 버튼 */}
        {hasHiddenItems && (
          <Button
            size="small"
            onClick={() => setShowAllItems(true)}
            startIcon={<ExpandMore />}
            sx={{ mt: 1 }}
          >
            {items.length - maxVisibleItems}개 더 보기
          </Button>
        )}
        {showAllItems && items.length > maxVisibleItems && (
          <Button
            size="small"
            onClick={() => setShowAllItems(false)}
            startIcon={<ExpandLess />}
            sx={{ mt: 1 }}
          >
            접기
          </Button>
        )}

        {/* 결과 요약 */}
        {isComplete && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              {completed > 0 && (
                <Chip
                  icon={<CheckCircle />}
                  label={`${completed}개 성공`}
                  color="success"
                  variant="outlined"
                />
              )}
              {failed > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${failed}개 실패`}
                  color="error"
                  variant="outlined"
                />
              )}
              {isCancelled && total - completed - failed > 0 && (
                <Chip
                  icon={<Cancel />}
                  label={`${total - completed - failed}개 취소됨`}
                  variant="outlined"
                />
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {isRunning && !isCancelled && (
          <>
            {isPaused ? (
              <Button
                onClick={onResume}
                startIcon={<PlayArrow />}
                color="primary"
              >
                재개
              </Button>
            ) : (
              <Button
                onClick={onPause}
                startIcon={<Pause />}
              >
                일시정지
              </Button>
            )}
            <Button
              onClick={onCancel}
              startIcon={<Cancel />}
              color="error"
            >
              취소
            </Button>
          </>
        )}
        {!isRunning && (
          <Button
            onClick={() => {
              onComplete?.();
              onClose();
            }}
            variant="contained"
          >
            확인
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkProgressDialog;
