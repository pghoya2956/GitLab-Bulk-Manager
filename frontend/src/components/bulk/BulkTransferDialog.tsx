import { useState, useEffect } from 'react';
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
  Chip,
  Autocomplete,
  TextField,
} from '@mui/material';
import { FolderOpen, Assignment, CheckCircle, Error, MoveUp } from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';
import type { GitLabGroup, GitLabProject } from '../../types/gitlab';

interface BulkTransferDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<(GitLabGroup | GitLabProject) & { type: 'group' | 'project' }>;
  onSuccess: () => void;
}

interface TransferResult {
  success: Array<{ id: number; name: string; type: 'group' | 'project'; newNamespaceId: number }>;
  failed: Array<{ id: number; name: string; type: 'group' | 'project'; error: string }>;
  total: number;
}

interface Namespace {
  id: number;
  name: string;
  full_path: string;
  kind: string;
}

export function BulkTransferDialog({ open, onClose, selectedItems, onSuccess }: BulkTransferDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  useEffect(() => {
    if (open) {
      loadNamespaces();
    }
  }, [open]);

  const loadNamespaces = async () => {
    setLoadingNamespaces(true);
    try {
      // 네임스페이스(그룹) 목록 가져오기
      const groups = await gitlabService.getGroups({ per_page: 100 });
      const namespaceList = groups.map(group => ({
        id: group.id,
        name: group.name,
        full_path: group.full_path,
        kind: 'group'
      }));
      setNamespaces(namespaceList);
    } catch (error) {
      console.error('Failed to load namespaces:', error);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedNamespace) return;

    setLoading(true);
    setResult(null);

    try {
      const items = selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type
      }));

      const response = await gitlabService.bulkTransfer(items, selectedNamespace.id);
      
      setResult({
        success: (response as any).success || [],
        failed: (response as any).failed || [],
        total: (response as any).total || items.length
      });

      if ((response as any).success?.length > 0) {
        onSuccess();
      }
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
      setResult(null);
      setSelectedNamespace(null);
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
          일괄 네임스페이스 이동
        </Typography>
      </DialogTitle>

      <DialogContent>
        {!result && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                선택한 항목을 다른 네임스페이스(그룹)로 이동합니다.
              </Typography>
            </Alert>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                이동할 항목:
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

            <Box sx={{ mb: 3 }}>
              <Autocomplete
                options={namespaces}
                getOptionLabel={(option) => `${option.name} (${option.full_path})`}
                value={selectedNamespace}
                onChange={(_, newValue) => setSelectedNamespace(newValue)}
                loading={loadingNamespaces}
                disabled={loading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="대상 네임스페이스"
                    placeholder="이동할 네임스페이스를 선택하세요"
                    variant="outlined"
                    fullWidth
                  />
                )}
              />
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
          </>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              이동 중...
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
                        secondary={`${item.type === 'group' ? '그룹' : '프로젝트'} → 네임스페이스 ID: ${item.newNamespaceId}`}
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
            onClick={handleTransfer}
            color="primary"
            variant="contained"
            disabled={loading || !selectedNamespace || selectedItems.length === 0}
            startIcon={<MoveUp />}
          >
            이동
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}