import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Slider,
} from '@mui/material';
import {
  Refresh,
  Delete,
  Info,
  PlayArrow,
  Stop,
  CheckCircle,
  Error,
  Schedule,
  Sync,
  CleaningServices,
  DeleteSweep,
  Replay,
} from '@mui/icons-material';
import { gitlabService } from '../services/gitlab';
import MigrationProgress from '../components/svn/MigrationProgress';
import ResumeMigrationDialog from '../components/svn/ResumeMigrationDialog';
import { useNavigate } from 'react-router-dom';

interface Migration {
  id: string;
  svn_url: string;
  gitlab_project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'syncing' | 'cancelled';
  created_at: string;
  updated_at: string;
  last_synced_revision?: string;
  metadata?: {
    project_name?: string;
    project_path?: string;
    error?: string;
    jobId?: string;
    totalCommits?: number;
    lastRevision?: string;
  };
  job?: {
    progress?: number;
  };
}

const MigrationMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [cleaningJobs, setCleaningJobs] = useState(false);
  const [selectedMigrations, setSelectedMigrations] = useState<Set<string>>(new Set());
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);
  const [cleanOptions, setCleanOptions] = useState({
    includeCompleted: true,
    includeFailed: false,
  });
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedMigrationForResume, setSelectedMigrationForResume] = useState<Migration | null>(null);
  const [concurrentLimit, setConcurrentLimit] = useState(2);

  const loadMigrations = async () => {
    setLoading(true);
    try {
      const [migrationsData, queueData] = await Promise.all([
        gitlabService.getMigrations(),
        gitlabService.getJobQueueStatus(),
      ]);
      setMigrations(migrationsData);
      setQueueStatus(queueData);
    } catch (error) {
      console.error('Failed to load migrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMigrations();
    // 자동 새로고침 - 5초마다
    const interval = setInterval(loadMigrations, 5000);
    
    // 페이지 로드 시 큐 정리
    setTimeout(async () => {
      const [migrationsData, queueData] = await Promise.all([
        gitlabService.getMigrations(),
        gitlabService.getJobQueueStatus(),
      ]);
      
      // 큐에 실패한 작업이 있지만 실제 마이그레이션 테이블에는 없는 경우 정리
      const failedMigrations = migrationsData.filter(m => m.status === 'failed').length;
      if (queueData.migration.failed > 0 && failedMigrations === 0) {
        handleCleanFailedJobs();
      }
    }, 1000);
    
    // 동시 실행 수 로드
    loadConcurrentLimit();
    
    return () => clearInterval(interval);
  }, []);

  const loadConcurrentLimit = async () => {
    try {
      const { limit } = await gitlabService.getConcurrentLimit();
      setConcurrentLimit(limit);
    } catch (error) {
      console.error('Failed to load concurrent limit:', error);
    }
  };

  const handleConcurrentLimitChange = async (_: any, value: number | number[]) => {
    const newLimit = Array.isArray(value) ? value[0] : value;
    setConcurrentLimit(newLimit);
    try {
      await gitlabService.setConcurrentLimit(newLimit);
    } catch (error) {
      console.error('Failed to set concurrent limit:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'registered':
        return <Schedule color="disabled" />;
      case 'pending':
        return <Schedule color="action" />;
      case 'running':
        return <Sync color="primary" className="spinning" />;
      case 'syncing':
        return <Sync color="info" className="spinning" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'cancelled':
        return <Stop color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registered':
        return 'default';
      case 'pending':
        return 'warning';
      case 'running':
        return 'primary';
      case 'syncing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleDelete = async (migrationId: string) => {
    if (window.confirm('이 마이그레이션을 삭제하시겠습니까?')) {
      try {
        await gitlabService.deleteMigration(migrationId);
        await loadMigrations();
      } catch (error) {
        console.error('Failed to delete migration:', error);
      }
    }
  };

  const handleSync = async (migrationId: string) => {
    try {
      await gitlabService.syncMigration(migrationId);
      await loadMigrations();
    } catch (error) {
      console.error('Failed to sync migration:', error);
    }
  };

  const handleStop = async (migrationId: string) => {
    if (window.confirm('실행 중인 마이그레이션을 중지하시겠습니까?')) {
      try {
        await gitlabService.stopMigration(migrationId);
        await loadMigrations();
      } catch (error) {
        console.error('Failed to stop migration:', error);
      }
    }
  };

  const handleCleanFailedJobs = async () => {
    setCleaningJobs(true);
    try {
      const result = await gitlabService.cleanFailedJobs();
      console.log('Cleaned jobs:', result);
      await loadMigrations();
    } catch (error) {
      console.error('Failed to clean failed jobs:', error);
    } finally {
      setCleaningJobs(false);
    }
  };

  // Auto-clean failed jobs when count exceeds threshold
  useEffect(() => {
    const migrationFailed = queueStatus?.migration.actualFailed || queueStatus?.migration.failed || 0;
    const syncFailed = queueStatus?.sync.failed || 0;
    
    if (migrationFailed > 5 || syncFailed > 5) {
      const timer = setTimeout(() => {
        handleCleanFailedJobs();
      }, 10000); // Clean after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [queueStatus?.migration.actualFailed, queueStatus?.migration.failed, queueStatus?.sync.failed]);

  const handleShowDetails = (migrationId: string) => {
    setSelectedMigration(migrationId);
    setDetailsOpen(true);
  };

  const handleResume = (migration: Migration) => {
    setSelectedMigrationForResume(migration);
    setResumeDialogOpen(true);
  };

  const handleStart = async (migrationId: string) => {
    try {
      await gitlabService.startMigrations([migrationId]);
      await loadMigrations();
    } catch (error) {
      console.error('Failed to start migration:', error);
    }
  };

  const handleBulkStart = async () => {
    const registeredMigrations = Array.from(selectedMigrations).filter(id => {
      const migration = migrations.find(m => m.id === id);
      return migration?.status === 'registered';
    });

    if (registeredMigrations.length === 0) {
      alert('실행할 등록된 마이그레이션을 선택하세요.');
      return;
    }

    try {
      await gitlabService.startMigrations(registeredMigrations);
      setSelectedMigrations(new Set());
      await loadMigrations();
    } catch (error) {
      console.error('Failed to start migrations:', error);
    }
  };

  const handleResumeComplete = () => {
    setResumeDialogOpen(false);
    setSelectedMigrationForResume(null);
    loadMigrations();
  };

  const handleSelectMigration = (migrationId: string) => {
    const newSelected = new Set(selectedMigrations);
    if (newSelected.has(migrationId)) {
      newSelected.delete(migrationId);
    } else {
      newSelected.add(migrationId);
    }
    setSelectedMigrations(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMigrations.size === migrations.length) {
      setSelectedMigrations(new Set());
    } else {
      setSelectedMigrations(new Set(migrations.map(m => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (selectedMigrations.size > 0) {
        // 선택된 항목 삭제
        await gitlabService.cleanMigrations({
          migrationIds: Array.from(selectedMigrations),
        });
        setSelectedMigrations(new Set());
      } else {
        // 상태별 일괄 삭제
        await gitlabService.cleanMigrations(cleanOptions);
      }
      setCleanDialogOpen(false);
      await loadMigrations();
    } catch (error) {
      console.error('Failed to clean migrations:', error);
    }
  };

  const formatDate = (dateString: string) => {
    // UTC 시간을 로컬 시간으로 변환하여 표시
    const date = new Date(dateString);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const calculateDuration = (start: string, end?: string) => {
    // SQLite의 CURRENT_TIMESTAMP는 UTC로 저장되므로, 
    // 로컬 시간으로 변환하여 계산
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    
    // 음수가 되는 경우 (시간대 차이로 인한 문제) 방지
    const duration = Math.max(0, endTime - startTime);

    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">SVN 마이그레이션 모니터</Typography>
        <Box>
          {selectedMigrations.size > 0 && migrations.some(m => selectedMigrations.has(m.id) && m.status === 'registered') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrow />}
              onClick={handleBulkStart}
              sx={{ mr: 2 }}
            >
              선택 항목 시작 ({Array.from(selectedMigrations).filter(id => migrations.find(m => m.id === id)?.status === 'registered').length})
            </Button>
          )}
          {(selectedMigrations.size > 0 || migrations.some(m => m.status === 'completed' || m.status === 'failed')) && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweep />}
              onClick={() => setCleanDialogOpen(true)}
              sx={{ mr: 2 }}
            >
              {selectedMigrations.size > 0 
                ? `선택 항목 삭제 (${selectedMigrations.size})`
                : '마이그레이션 정리'
              }
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={() => navigate('/groups-projects')}
            sx={{ mr: 2 }}
          >
            새 마이그레이션
          </Button>
          <IconButton onClick={loadMigrations} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* 통합 작업 큐 UI */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px 0 rgba(0,0,0,.14), 0 7px 10px -5px rgba(33,150,243,.4)',
              }}
            >
              <Sync sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                작업 큐
              </Typography>
              <Typography variant="body2" color="text.secondary">
                마이그레이션 및 동기화 작업 현황
              </Typography>
            </Box>
          </Box>
          {queueStatus && (() => {
            const migrationFailed = queueStatus?.migrationTable?.failed || 
                                   queueStatus?.migration.actualFailed || 
                                   queueStatus?.migration.failed || 0;
            const syncFailed = queueStatus?.sync.failed || 0;
            return (migrationFailed + syncFailed) > 0;
          })() && (
            <Tooltip title="실패한 작업을 정리합니다">
              <IconButton
                onClick={handleCleanFailedJobs}
                disabled={cleaningJobs}
                sx={{
                  backgroundColor: 'error.light',
                  color: 'white',
                  '&:hover': { backgroundColor: 'error.main' },
                }}
              >
                <CleaningServices />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* 전체 통계 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {(queueStatus?.migration.active || 0) + (queueStatus?.sync.active || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">진행 중</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {(queueStatus?.migration.waiting || 0) + (queueStatus?.sync.waiting || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">대기 중</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
              {(queueStatus?.migration.completed || 0) + (queueStatus?.sync.completed || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">완료</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'error.main' }}>
              {(() => {
                // 실제 데이터베이스 상태를 우선 사용, 없으면 큐 상태 사용
                const migrationFailed = queueStatus?.migrationTable?.failed || 
                                       queueStatus?.migration.actualFailed || 
                                       queueStatus?.migration.failed || 0;
                const syncFailed = queueStatus?.sync.failed || 0;
                return migrationFailed + syncFailed;
              })()}
            </Typography>
            <Typography variant="body2" color="text.secondary">실패</Typography>
          </Box>
        </Box>

        {/* 전체 진행률 */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">전체 진행률</Typography>
            <Typography variant="body2" color="text.secondary">
              {(() => {
                const total = (queueStatus?.migration.completed || 0) + (queueStatus?.migration.waiting || 0) + 
                             (queueStatus?.migration.active || 0) + (queueStatus?.sync.completed || 0) + 
                             (queueStatus?.sync.waiting || 0) + (queueStatus?.sync.active || 0);
                const completed = (queueStatus?.migration.completed || 0) + (queueStatus?.sync.completed || 0);
                return total > 0 ? Math.round((completed / total) * 100) : 0;
              })()}%
            </Typography>
          </Box>
          <LinearProgress 
            variant={((queueStatus?.migration.active || 0) + (queueStatus?.sync.active || 0)) > 0 ? "indeterminate" : "determinate"}
            value={(() => {
              const total = (queueStatus?.migration.completed || 0) + (queueStatus?.migration.waiting || 0) + 
                           (queueStatus?.migration.active || 0) + (queueStatus?.sync.completed || 0) + 
                           (queueStatus?.sync.waiting || 0) + (queueStatus?.sync.active || 0);
              const completed = (queueStatus?.migration.completed || 0) + (queueStatus?.sync.completed || 0);
              return total > 0 ? (completed / total) * 100 : 0;
            })()}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* 동시 실행 수 설정 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            동시 실행 수: {concurrentLimit}
          </Typography>
          <Slider
            value={concurrentLimit}
            onChange={handleConcurrentLimitChange}
            min={1}
            max={10}
            marks
            valueLabelDisplay="auto"
            sx={{ maxWidth: 300 }}
          />
        </Box>

        {/* 작업 타입별 세부 정보 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PlayArrow sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                마이그레이션
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`진행: ${queueStatus?.migration.active || 0}`} />
              <Chip size="small" label={`대기: ${queueStatus?.migration.waiting || 0}`} />
              <Chip size="small" label={`완료: ${queueStatus?.migration.completed || 0}`} color="success" />
              {(() => {
                const failed = queueStatus?.migrationTable?.failed || 
                              queueStatus?.migration.actualFailed || 
                              queueStatus?.migration.failed || 0;
                return failed > 0 && (
                  <Chip size="small" label={`실패: ${failed}`} color="error" />
                );
              })()}
            </Box>
          </Box>

          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Sync sx={{ color: 'info.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                동기화
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`진행: ${queueStatus?.sync.active || 0}`} />
              <Chip size="small" label={`대기: ${queueStatus?.sync.waiting || 0}`} />
              <Chip size="small" label={`완료: ${queueStatus?.sync.completed || 0}`} color="success" />
              {(queueStatus?.sync.failed || 0) > 0 && (
                <Chip size="small" label={`실패: ${queueStatus.sync.failed}`} color="error" />
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedMigrations.size > 0 && selectedMigrations.size < migrations.length}
                  checked={migrations.length > 0 && selectedMigrations.size === migrations.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>상태</TableCell>
              <TableCell>SVN URL</TableCell>
              <TableCell>GitLab 프로젝트</TableCell>
              <TableCell>시작 시간</TableCell>
              <TableCell>소요 시간</TableCell>
              <TableCell>진행률/커밋</TableCell>
              <TableCell align="right">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {migrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      진행 중인 마이그레이션이 없습니다.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              migrations.map((migration) => (
                <TableRow key={migration.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedMigrations.has(migration.id)}
                      onChange={() => handleSelectMigration(migration.id)}
                      disabled={migration.status === 'running'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(migration.status)}
                      <Chip
                        label={migration.status}
                        size="small"
                        color={getStatusColor(migration.status) as any}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {migration.svn_url}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {migration.metadata?.project_name || migration.gitlab_project_id}
                  </TableCell>
                  <TableCell>{formatDate(migration.created_at)}</TableCell>
                  <TableCell>
                    {calculateDuration(migration.created_at, migration.status === 'completed' ? migration.updated_at : undefined)}
                  </TableCell>
                  <TableCell>
                    {migration.status === 'running' ? (
                      <Box>
                        <LinearProgress
                          variant="indeterminate"
                          sx={{ mb: 0.5, height: 4 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          처리 중...
                        </Typography>
                      </Box>
                    ) : migration.status === 'completed' ? (
                      <Box>
                        <Typography variant="body2">
                          {migration.metadata?.totalCommits || '-'} 커밋
                        </Typography>
                        {migration.last_synced_revision && (
                          <Typography variant="caption" color="text.secondary">
                            최종 리비전: r{migration.last_synced_revision}
                          </Typography>
                        )}
                      </Box>
                    ) : migration.status === 'failed' && migration.metadata?.error ? (
                      <Tooltip title={migration.metadata.error}>
                        <Typography variant="caption" color="error">
                          오류 발생
                        </Typography>
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="상세 정보">
                      <IconButton size="small" onClick={() => handleShowDetails(migration.id)}>
                        <Info />
                      </IconButton>
                    </Tooltip>
                    {migration.status === 'registered' && (
                      <Tooltip title="시작">
                        <IconButton size="small" onClick={() => handleStart(migration.id)} color="primary">
                          <PlayArrow />
                        </IconButton>
                      </Tooltip>
                    )}
                    {migration.status === 'running' && (
                      <Tooltip title="중지">
                        <IconButton size="small" onClick={() => handleStop(migration.id)} color="error">
                          <Stop />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(migration.status === 'failed' || migration.status === 'cancelled') && (
                      <Tooltip title="재개">
                        <IconButton size="small" onClick={() => handleResume(migration)} color="primary">
                          <Replay />
                        </IconButton>
                      </Tooltip>
                    )}
                    {migration.status === 'completed' && (
                      <Tooltip title="증분 동기화">
                        <IconButton size="small" onClick={() => handleSync(migration.id)}>
                          <Sync />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="삭제">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(migration.id)}
                        disabled={migration.status === 'running' || migration.status === 'syncing'}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {loading && <LinearProgress sx={{ mt: 2 }} />}

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>마이그레이션 상세 정보</DialogTitle>
        <DialogContent>
          {selectedMigration && (
            <MigrationProgress
              migrationId={selectedMigration}
              onComplete={() => {
                setDetailsOpen(false);
                loadMigrations();
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cleanDialogOpen} onClose={() => setCleanDialogOpen(false)}>
        <DialogTitle>
          {selectedMigrations.size > 0 
            ? `선택한 ${selectedMigrations.size}개 마이그레이션 삭제`
            : '마이그레이션 기록 정리'
          }
        </DialogTitle>
        <DialogContent>
          {selectedMigrations.size > 0 ? (
            <Typography>
              선택한 마이그레이션 기록을 삭제하시겠습니까? 
              이 작업은 되돌릴 수 없습니다.
            </Typography>
          ) : (
            <Box>
              <Typography sx={{ mb: 2 }}>
                어떤 상태의 마이그레이션을 정리하시겠습니까?
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={cleanOptions.includeCompleted}
                      onChange={(e) => setCleanOptions({
                        ...cleanOptions,
                        includeCompleted: e.target.checked
                      })}
                    />
                  }
                  label="완료된 마이그레이션"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={cleanOptions.includeFailed}
                      onChange={(e) => setCleanOptions({
                        ...cleanOptions,
                        includeFailed: e.target.checked
                      })}
                    />
                  }
                  label="실패한 마이그레이션"
                />
              </FormGroup>
              <Alert severity="warning" sx={{ mt: 2 }}>
                삭제된 마이그레이션 기록은 복구할 수 없습니다.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanDialogOpen(false)}>취소</Button>
          <Button 
            onClick={handleBulkDelete} 
            color="error" 
            variant="contained"
            disabled={!selectedMigrations.size && !cleanOptions.includeCompleted && !cleanOptions.includeFailed}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {selectedMigrationForResume && (
        <ResumeMigrationDialog
          open={resumeDialogOpen}
          onClose={() => setResumeDialogOpen(false)}
          migration={selectedMigrationForResume}
          onResume={handleResumeComplete}
        />
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spinning {
            animation: spin 2s linear infinite;
          }
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.8;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes shake {
            0%, 100% {
              transform: translateX(0);
            }
            25% {
              transform: translateX(-5px);
            }
            75% {
              transform: translateX(5px);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default MigrationMonitor;