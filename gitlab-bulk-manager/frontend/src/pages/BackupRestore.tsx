import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  Checkbox,
  TextField,
  Alert,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  Code as CodeIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/auth';
import { PermissionGuard } from '../components/PermissionGuard';
import { formatBytes, formatDate } from '../utils/format';
import { gitlabService } from '../services/gitlab';
import { useNotification } from '../hooks/useNotification';

interface BackupItem {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  type: 'full' | 'groups' | 'projects' | 'selective';
  status: 'completed' | 'in_progress' | 'failed';
  progress?: number;
  items?: {
    groups: number;
    projects: number;
    members: number;
  };
}

interface BackupOptions {
  includeGroups: boolean;
  includeProjects: boolean;
  includeMembers: boolean;
  includeWikis: boolean;
  includeIssues: boolean;
  includeMergeRequests: boolean;
  includeSettings: boolean;
  selectedGroupIds?: number[];
  selectedProjectIds?: number[];
}

export const BackupRestore: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { showSuccess, showError } = useNotification();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    includeGroups: true,
    includeProjects: true,
    includeMembers: true,
    includeWikis: true,
    includeIssues: true,
    includeMergeRequests: true,
    includeSettings: true,
  });

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockBackups: BackupItem[] = [
        {
          id: '1',
          name: 'Full Backup - 2024-01-01',
          createdAt: '2024-01-01T00:00:00Z',
          size: 1024 * 1024 * 500, // 500MB
          type: 'full',
          status: 'completed',
          items: { groups: 25, projects: 150, members: 50 },
        },
        {
          id: '2',
          name: 'Projects Backup - 2024-01-05',
          createdAt: '2024-01-05T12:00:00Z',
          size: 1024 * 1024 * 300, // 300MB
          type: 'projects',
          status: 'completed',
          items: { groups: 0, projects: 150, members: 0 },
        },
        {
          id: '3',
          name: 'Scheduled Backup',
          createdAt: new Date().toISOString(),
          size: 0,
          type: 'full',
          status: 'in_progress',
          progress: 45,
          items: { groups: 10, projects: 67, members: 25 },
        },
      ];
      setBackups(mockBackups);
    } catch (error) {
      showError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      // In real implementation, this would call the backup API
      showSuccess('Backup started successfully');
      setCreateDialogOpen(false);
      await loadBackups();
    } catch (error) {
      showError('Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    try {
      setLoading(true);
      // In real implementation, this would call the restore API
      showSuccess(`Restore from ${selectedBackup.name} started`);
      setRestoreDialogOpen(false);
    } catch (error) {
      showError('Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      setLoading(true);
      // In real implementation, this would call the delete API
      showSuccess('Backup deleted successfully');
      await loadBackups();
    } catch (error) {
      showError('Failed to delete backup');
    } finally {
      setLoading(false);
    }
  };

  const getBackupIcon = (type: string) => {
    switch (type) {
      case 'groups':
        return <GroupIcon />;
      case 'projects':
        return <CodeIcon />;
      default:
        return <FolderIcon />;
    }
  };

  return (
    <PermissionGuard permissions={[Permission.SYSTEM_BACKUP, Permission.SYSTEM_RESTORE]}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4">백업 & 복원</Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              sx={{ mr: 2 }}
              disabled={!hasPermission(Permission.SYSTEM_BACKUP)}
            >
              스케줄 설정
            </Button>
            <Button
              variant="contained"
              startIcon={<BackupIcon />}
              onClick={() => setCreateDialogOpen(true)}
              disabled={!hasPermission(Permission.SYSTEM_BACKUP)}
            >
              새 백업 생성
            </Button>
          </Box>
        </Box>

        {/* Statistics */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  총 백업 수
                </Typography>
                <Typography variant="h3">
                  {backups.filter(b => b.status === 'completed').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  총 백업 크기
                </Typography>
                <Typography variant="h3">
                  {formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  마지막 백업
                </Typography>
                <Typography variant="h6">
                  {backups.length > 0 ? formatDate(backups[0].createdAt) : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Backup List */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            백업 목록
          </Typography>
          
          {loading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <LinearProgress />
            </Box>
          ) : backups.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                백업이 없습니다
              </Typography>
            </Box>
          ) : (
            <List>
              {backups.map((backup) => (
                <ListItem
                  key={backup.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    p: 2,
                  }}
                >
                  <ListItemIcon>
                    {getBackupIcon(backup.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {backup.name}
                        </Typography>
                        <Chip
                          label={backup.type}
                          size="small"
                          color={backup.type === 'full' ? 'primary' : 'default'}
                        />
                        {backup.status === 'in_progress' && (
                          <Chip label="진행 중" size="small" color="warning" />
                        )}
                        {backup.status === 'failed' && (
                          <Chip label="실패" size="small" color="error" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(backup.createdAt)} • {formatBytes(backup.size)}
                          {backup.items && (
                            <> • 그룹: {backup.items.groups}, 프로젝트: {backup.items.projects}, 멤버: {backup.items.members}</>
                          )}
                        </Typography>
                        {backup.status === 'in_progress' && backup.progress && (
                          <Box sx={{ mt: 1 }}>
                            <LinearProgress variant="determinate" value={backup.progress} />
                            <Typography variant="caption" color="text.secondary">
                              {backup.progress}% 완료
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <Box>
                    <IconButton
                      onClick={() => {
                        setSelectedBackup(backup);
                        setRestoreDialogOpen(true);
                      }}
                      disabled={backup.status !== 'completed' || !hasPermission(Permission.SYSTEM_RESTORE)}
                      title="복원"
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      disabled={backup.status !== 'completed'}
                      title="다운로드"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeleteBackup(backup.id)}
                      disabled={backup.status === 'in_progress' || !hasPermission(Permission.SYSTEM_BACKUP)}
                      title="삭제"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* Create Backup Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>새 백업 생성</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="백업 이름"
              placeholder="예: 주간 백업 - 2024-01-01"
              sx={{ mb: 3, mt: 1 }}
            />
            
            <Typography variant="subtitle2" gutterBottom>
              백업 포함 항목
            </Typography>
            <FormControl component="fieldset">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeGroups}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeGroups: e.target.checked })}
                  />
                }
                label="그룹"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeProjects}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeProjects: e.target.checked })}
                  />
                }
                label="프로젝트"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeMembers}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeMembers: e.target.checked })}
                  />
                }
                label="멤버"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeWikis}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeWikis: e.target.checked })}
                  />
                }
                label="위키"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeIssues}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeIssues: e.target.checked })}
                  />
                }
                label="이슈"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeMergeRequests}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeMergeRequests: e.target.checked })}
                  />
                }
                label="머지 리퀘스트"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={backupOptions.includeSettings}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeSettings: e.target.checked })}
                  />
                }
                label="설정"
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>취소</Button>
            <Button onClick={handleCreateBackup} variant="contained" disabled={loading}>
              백업 시작
            </Button>
          </DialogActions>
        </Dialog>

        {/* Restore Dialog */}
        <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>백업 복원</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              복원 작업은 현재 데이터를 덮어씁니다. 계속하시겠습니까?
            </Alert>
            {selectedBackup && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  복원할 백업
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                  <Typography variant="body1">{selectedBackup.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(selectedBackup.createdAt)} • {formatBytes(selectedBackup.size)}
                  </Typography>
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRestoreDialogOpen(false)}>취소</Button>
            <Button onClick={handleRestoreBackup} variant="contained" color="warning" disabled={loading}>
              복원 시작
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGuard>
  );
};