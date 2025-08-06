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
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { gitlabService } from '../../services/gitlab';
import { useNotification } from '../../hooks/useNotification';

interface BulkCloneDialogProps {
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

export const BulkCloneDialog: React.FC<BulkCloneDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkOperationResults | null>(null);
  const [namingOption, setNamingOption] = useState<'suffix' | 'custom'>('suffix');
  const [suffix, setSuffix] = useState('_copy');
  const [customName, setCustomName] = useState('');
  const { showSuccess, showError } = useNotification();

  const handleClone = async () => {
    if (namingOption === 'custom' && !customName.trim()) {
      showError('사용자 정의 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const nameModifier = namingOption === 'suffix' ? suffix : customName;
      const response = await gitlabService.bulkClone(items, nameModifier);
      
      if (response.results) {
        setResults(response.results);
        
        if (response.results.successful?.length > 0) {
          showSuccess(`${response.results.successful.length}개 항목이 성공적으로 복제되었습니다`);
        }
        if (response.results.failed?.length > 0) {
          showError(`${response.results.failed.length}개 항목 복제 실패`);
        }
        
        if (onSuccess && response.results.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || '복제 중 오류가 발생했습니다');
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

  const groups = selectedItems.filter(item => item.type === 'group');
  const projects = selectedItems.filter(item => item.type === 'project');

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
          <ContentCopyIcon color="action" />
          <Typography variant="h6">항목 복제</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!results && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                선택한 프로젝트와 그룹을 복제합니다. 
                복제된 항목은 원본과 동일한 설정을 가지지만 독립적으로 관리됩니다.
              </Typography>
            </Alert>

            {/* Selected items summary */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                복제할 항목 ({selectedItems.length}개):
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {groups.length > 0 && (
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FolderIcon fontSize="small" color="warning" />
                    {groups.length}개 그룹
                  </Typography>
                )}
                {projects.length > 0 && (
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CodeIcon fontSize="small" color="primary" />
                    {projects.length}개 프로젝트
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Naming options */}
            <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
              <FormLabel component="legend">복제 이름 설정</FormLabel>
              <RadioGroup
                value={namingOption}
                onChange={(e) => setNamingOption(e.target.value as 'suffix' | 'custom')}
              >
                <FormControlLabel 
                  value="suffix" 
                  control={<Radio />} 
                  label="접미사 추가" 
                />
                {namingOption === 'suffix' && (
                  <TextField
                    fullWidth
                    size="small"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="_copy"
                    sx={{ ml: 4, mb: 1 }}
                    helperText="예: project_name → project_name_copy"
                  />
                )}
                
                <FormControlLabel 
                  value="custom" 
                  control={<Radio />} 
                  label="사용자 정의 이름" 
                />
                {namingOption === 'custom' && (
                  <TextField
                    fullWidth
                    size="small"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="새 이름 입력"
                    sx={{ ml: 4, mb: 1 }}
                    helperText="모든 복제 항목에 이 이름이 사용됩니다"
                  />
                )}
              </RadioGroup>
            </FormControl>

            {/* Items list */}
            <Typography variant="subtitle2" gutterBottom>
              복제될 항목 목록:
            </Typography>
            <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
              {selectedItems.map((item) => (
                <ListItem key={item.id}>
                  <ListItemIcon>
                    {item.type === 'group' ? (
                      <FolderIcon color="warning" />
                    ) : (
                      <CodeIcon color="primary" />
                    )}
                  </ListItemIcon>
                  <ListItemText 
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{item.name}</span>
                        <span>→</span>
                        <span style={{ fontWeight: 'bold' }}>
                          {namingOption === 'suffix' 
                            ? `${item.name}${suffix}` 
                            : customName || '새 이름'}
                        </span>
                      </Box>
                    }
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
              항목을 복제하는 중...
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

            {results.successful.length > 0 && (
              <>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  성공한 항목:
                </Typography>
                <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                  {results.successful.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={item.name} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {results.failed.length > 0 && (
              <>
                <Typography variant="subtitle2" color="error" gutterBottom sx={{ mt: 2 }}>
                  실패한 항목:
                </Typography>
                <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
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
        {!results && (
          <Button 
            onClick={handleClone} 
            variant="contained" 
            disabled={loading || (namingOption === 'custom' && !customName.trim())}
            startIcon={<ContentCopyIcon />}
          >
            복제
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};