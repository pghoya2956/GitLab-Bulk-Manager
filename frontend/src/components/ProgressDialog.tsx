import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Typography,
  Alert,
  Box,
  Button,
  CircularProgress,
} from '@mui/material';

interface ProgressDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  progress?: number;  // 0-100, undefined means indeterminate
  error?: string | null;
  success?: boolean;
  showCloseButton?: boolean;
}

const ProgressDialog: React.FC<ProgressDialogProps> = ({
  open,
  onClose,
  title = '작업 진행 중...',
  message,
  progress,
  error,
  success,
  showCloseButton = false,
}) => {
  const isIndeterminate = progress === undefined;
  const isComplete = progress === 100 || success;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth onClose={showCloseButton ? onClose : undefined}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          {isIndeterminate ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                {message || '처리 중...'}
              </Typography>
            </Box>
          ) : (
            <>
              <LinearProgress variant="determinate" value={progress} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {message || (isComplete ? '완료!' : '처리 중...')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress}%
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {isComplete && !error && (
          <Alert severity="success" sx={{ mt: 2 }}>
            작업이 성공적으로 완료되었습니다!
          </Alert>
        )}
      </DialogContent>
      {showCloseButton && (
        <DialogActions>
          <Button onClick={onClose}>닫기</Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ProgressDialog;
