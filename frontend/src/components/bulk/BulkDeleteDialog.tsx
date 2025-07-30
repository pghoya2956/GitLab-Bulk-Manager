import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  LinearProgress,
  Box,
  Checkbox,
  Chip,
} from '@mui/material';
import { FolderOpen, Assignment, Warning, CheckCircle, Error } from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';
import type { GitLabGroup, GitLabProject } from '../../types/gitlab';

interface BulkDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<(GitLabGroup | GitLabProject) & { type: 'group' | 'project' }>;
  onSuccess: () => void;
}

interface DeleteResult {
  success: Array<{ id: number; name: string; type: 'group' | 'project' }>;
  failed: Array<{ id: number; name: string; type: 'group' | 'project'; error: string }>;
  total: number;
}

export function BulkDeleteDialog({ open, onClose, selectedItems, onSuccess }: BulkDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const handleDelete = async () => {
    if (!confirmChecked) return;

    setLoading(true);
    setResult(null);

    try {
      const items = selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type
      }));

      const response = await gitlabService.bulkDelete(items);
      
      setResult({
        success: (response as any).success || [],
        failed: (response as any).failed || [],
        total: (response as any).total || items.length
      });
      
      // Don't call onSuccess here - wait for dialog close
    } catch (error: any) {
      setResult({
        success: [],
        failed: selectedItems.map(item => ({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.message || 'Unknown error'
        })),
        total: selectedItems.length
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // If we had successful deletions, trigger refresh when closing
      if (result && result.success.length > 0) {
        onSuccess();
      }
      setResult(null);
      setConfirmChecked(false);
      onClose();
    }
  };

  const groupCount = selectedItems.filter(item => item.type === 'group').length;
  const projectCount = selectedItems.filter(item => item.type === 'project').length;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          일괄 삭제
        </Typography>
      </DialogTitle>

      <DialogContent>
        {!result && (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>주의:</strong> 이 작업은 되돌릴 수 없습니다. 선택한 모든 항목이 영구적으로 삭제됩니다.
              </Typography>
            </Alert>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                삭제할 항목:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {groupCount > 0 && (
                  <Chip
                    icon={<FolderOpen />}
                    label={`${groupCount}개 그룹`}
                    color="primary"
                    size="small"
                  />
                )}
                {projectCount > 0 && (
                  <Chip
                    icon={<Assignment />}
                    label={`${projectCount}개 프로젝트`}
                    color="secondary"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              <List dense>
                {selectedItems.map((item) => (
                  <ListItem key={`${item.type}-${item.id}`}>
                    <ListItemIcon>
                      {item.type === 'group' ? (
                        <FolderOpen color="primary" />
                      ) : (
                        <Assignment color="secondary" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.name}
                      secondary={'full_path' in item ? item.full_path : (item as any).path_with_namespace}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={loading}
              />
              <Typography variant="body2">
                위 항목을 모두 삭제하는 것을 확인합니다.
              </Typography>
            </Box>
          </>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              삭제 중...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert 
              severity={result.failed.length === 0 ? 'success' : result.success.length > 0 ? 'warning' : 'error'}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                전체: {result.total}개, 성공: {result.success.length}개, 실패: {result.failed.length}개
              </Typography>
            </Alert>

            {result.success.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  성공:
                </Typography>
                <List dense>
                  {result.success.map((item) => (
                    <ListItem key={`${item.type}-${item.id}`}>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={item.type === 'group' ? '그룹' : '프로젝트'}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {result.failed.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  실패:
                </Typography>
                <List dense>
                  {result.failed.map((item) => (
                    <ListItem key={`${item.type}-${item.id}`}>
                      <ListItemIcon>
                        <Error color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={item.error}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result ? '닫기' : '취소'}
        </Button>
        {!result && (
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading || !confirmChecked || selectedItems.length === 0}
            startIcon={<Warning />}
          >
            삭제
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}