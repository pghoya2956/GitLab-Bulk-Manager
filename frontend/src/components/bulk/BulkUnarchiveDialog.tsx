import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import { gitlabService } from '../../services/gitlab';
import { useNotification } from '../../hooks/useNotification';

interface BulkUnarchiveDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: () => void;
}

interface BulkOperationResults {
  successful: Array<{ id: number; name: string }>;
  failed: Array<{ id: number; name: string; error: string }>;
}

export const BulkUnarchiveDialog: React.FC<BulkUnarchiveDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkOperationResults | null>(null);
  const { showSuccess, showError } = useNotification();

  // Filter to only projects (groups cannot be archived/unarchived)
  const projects = selectedItems.filter(item => item.type === 'project');
  const groups = selectedItems.filter(item => item.type === 'group');

  const handleUnarchive = async () => {
    if (projects.length === 0) {
      showError('그룹은 보관 해제할 수 없습니다. 프로젝트만 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const items = projects.map(item => ({
        id: parseInt(item.id.replace('project-', '')),
        name: item.name,
        type: item.type as 'project',
      }));

      const response = await gitlabService.bulkUnarchive(items);
      
      if (response.results) {
        setResults(response.results);
        
        if (response.results.successful?.length > 0) {
          showSuccess(`${response.results.successful.length}개 프로젝트가 성공적으로 복원되었습니다`);
        }
        if (response.results.failed?.length > 0) {
          showError(`${response.results.failed.length}개 프로젝트 복원 실패`);
        }
        
        if (onSuccess && response.results.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || '프로젝트 복원 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResults(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UnarchiveIcon color="action" />
          <Typography variant="h6">프로젝트 보관 해제</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Warning for groups */}
        {groups.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>주의:</strong> 그룹은 보관 해제할 수 없습니다. 
              선택된 {groups.length}개 그룹은 건너뛰고 프로젝트만 복원됩니다.
            </Typography>
          </Alert>
        )}

        {/* No projects selected */}
        {projects.length === 0 && (
          <Alert severity="error">
            복원할 수 있는 프로젝트가 선택되지 않았습니다.
            보관된 프로젝트를 선택한 후 다시 시도해주세요.
          </Alert>
        )}

        {/* Projects to unarchive */}
        {projects.length > 0 && !results && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                보관 해제된 프로젝트는 다시 활성화되어 모든 기능을 사용할 수 있습니다.
              </Typography>
            </Alert>

            <Typography variant="subtitle2" gutterBottom>
              복원할 프로젝트 ({projects.length}개):
            </Typography>
            
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {projects.map((item) => (
                <ListItem key={item.id}>
                  <ListItemIcon>
                    <CodeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    secondary={item.full_path}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {/* Loading */}
        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              프로젝트를 복원하는 중...
            </Typography>
          </Box>
        )}

        {/* Results */}
        {results && (
          <Box sx={{ mt: 2 }}>
            <Alert 
              severity={results.failed.length === 0 ? 'success' : 'warning'}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                작업 완료
              </Typography>
              <Typography variant="body2">
                성공: {results.successful.length} | 실패: {results.failed.length}
              </Typography>
            </Alert>

            {results.failed.length > 0 && (
              <>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  실패한 항목:
                </Typography>
                <List dense>
                  {results.failed.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={item.name}
                        secondary={item.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {results ? '닫기' : '취소'}
        </Button>
        {!results && projects.length > 0 && (
          <Button 
            onClick={handleUnarchive} 
            variant="contained" 
            disabled={loading}
            startIcon={<UnarchiveIcon />}
          >
            보관 해제
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};