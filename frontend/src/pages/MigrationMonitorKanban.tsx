import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Avatar,
  Badge,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Refresh,
  MoreVert,
  PlayArrow,
  Stop,
  Delete,
  Sync,
  CheckCircle,
  Error,
  Schedule,
  Replay,
  Link,
  Timer,
  ExpandMore,
  Search,
  FilterList,
  DragIndicator,
  Lightbulb,
  Speed,
  History,
} from '@mui/icons-material';
import { gitlabService } from '../services/gitlab';
import MigrationProgress from '../components/svn/MigrationProgress';
import ResumeMigrationDialog from '../components/svn/ResumeMigrationDialog';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { animated, useSpring } from '@react-spring/web';

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
    currentRevision?: number;
    totalRevisions?: number;
    percentage?: number;
    isEstimated?: boolean;
  };
  job?: {
    progress?: number;
  };
}

interface QuickStartForm {
  svnUrl: string;
  projectName: string;
  authorsMapping: string;
}

interface MigrationCardProps {
  migration: Migration;
  onAction: (action: string, migration: Migration) => void;
  onShowDetails: (id: string) => void;
}

const MigrationCard: React.FC<MigrationCardProps> = ({ migration, onAction, onShowDetails }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: migration.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    pending: { icon: <Schedule />, color: 'default' as const, label: '대기 중' },
    running: { icon: <Sync className="spinning" />, color: 'primary' as const, label: '진행 중' },
    syncing: { icon: <Sync className="spinning" />, color: 'info' as const, label: '동기화 중' },
    completed: { icon: <CheckCircle />, color: 'success' as const, label: '완료' },
    failed: { icon: <Error />, color: 'error' as const, label: '실패' },
    cancelled: { icon: <Stop />, color: 'warning' as const, label: '취소됨' },
  };

  const config = statusConfig[migration.status];

  const getProgress = () => {
    if (migration.metadata?.percentage) {
      return migration.metadata.percentage;
    }
    if (migration.metadata?.totalRevisions && migration.metadata?.currentRevision) {
      return Math.round((migration.metadata.currentRevision / migration.metadata.totalRevisions) * 100);
    }
    return 0;
  };

  const getEstimatedTime = () => {
    if (migration.status !== 'running' || !migration.metadata?.currentRevision || !migration.metadata?.totalRevisions) {
      return null;
    }
    const elapsed = Date.now() - new Date(migration.created_at).getTime();
    const progress = migration.metadata.currentRevision / migration.metadata.totalRevisions;
    if (progress === 0) return null;
    const total = elapsed / progress;
    const remaining = total - elapsed;
    return Math.round(remaining / 60000); // minutes
  };

  const estimatedTime = getEstimatedTime();

  const animatedProps = useSpring({
    from: { opacity: 0, transform: 'scale(0.9)' },
    to: { opacity: 1, transform: 'scale(1)' },
    config: { tension: 300, friction: 30 },
  });

  return (
    <animated.div style={{ ...style, ...animatedProps }} ref={setNodeRef}>
      <Card 
        sx={{ 
          mb: 2, 
          cursor: 'move',
          '&:hover': { boxShadow: 4 },
          border: isDragging ? '2px dashed #1976d2' : 'none',
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <IconButton 
              size="small" 
              sx={{ p: 0.5, mr: 1, cursor: 'grab' }}
              {...attributes}
              {...listeners}
            >
              <DragIndicator fontSize="small" />
            </IconButton>
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Avatar sx={{ width: 24, height: 24, bgcolor: `${config.color}.main` }}>
                  {config.icon}
                </Avatar>
                <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                  {migration.metadata?.project_name || `Project ${migration.gitlab_project_id}`}
                </Typography>
                <Chip label={config.label} size="small" color={config.color} />
              </Box>
              
              <Typography variant="caption" color="text.secondary" noWrap>
                {migration.svn_url}
              </Typography>
            </Box>

            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          </Box>

          {migration.status === 'running' && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">
                  {migration.metadata?.currentRevision || 0} / {migration.metadata?.totalRevisions || '?'} 리비전
                </Typography>
                <Typography variant="caption" fontWeight="bold">
                  {getProgress()}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={getProgress()} 
                sx={{ height: 6, borderRadius: 3 }}
              />
              {estimatedTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <Timer fontSize="inherit" sx={{ fontSize: '0.75rem', mr: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    약 {estimatedTime}분 남음
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {migration.status === 'failed' && (
            <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
              {migration.metadata?.error || '알 수 없는 오류'}
            </Alert>
          )}

          {migration.status === 'completed' && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {migration.metadata?.totalCommits || 0} 커밋
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(migration.updated_at), { locale: ko, addSuffix: true })}
              </Typography>
            </Box>
          )}
        </CardContent>

        <Collapse in={expanded}>
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="caption" color="text.secondary">
              시작: {new Date(migration.created_at).toLocaleString('ko-KR')}
            </Typography>
            {migration.last_synced_revision && (
              <Typography variant="caption" color="text.secondary" display="block">
                최종 리비전: r{migration.last_synced_revision}
              </Typography>
            )}
          </CardContent>
        </Collapse>

        <CardActions sx={{ py: 0.5 }}>
          <Button 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            endIcon={<ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
          >
            {expanded ? '접기' : '더보기'}
          </Button>
          <Button size="small" onClick={() => onShowDetails(migration.id)}>
            상세 정보
          </Button>
        </CardActions>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {migration.status === 'running' && (
          <MenuItem onClick={() => { onAction('stop', migration); setAnchorEl(null); }}>
            <Stop fontSize="small" sx={{ mr: 1 }} /> 중지
          </MenuItem>
        )}
        {(migration.status === 'failed' || migration.status === 'cancelled') && (
          <MenuItem onClick={() => { onAction('resume', migration); setAnchorEl(null); }}>
            <Replay fontSize="small" sx={{ mr: 1 }} /> 재시도
          </MenuItem>
        )}
        {migration.status === 'completed' && (
          <MenuItem onClick={() => { onAction('sync', migration); setAnchorEl(null); }}>
            <Sync fontSize="small" sx={{ mr: 1 }} /> 동기화
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => { onAction('delete', migration); setAnchorEl(null); }}
          disabled={migration.status === 'running' || migration.status === 'syncing'}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} /> 삭제
        </MenuItem>
      </Menu>
    </animated.div>
  );
};

const MigrationMonitorKanban: React.FC = () => {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartForm, setQuickStartForm] = useState<QuickStartForm>({
    svnUrl: '',
    projectName: '',
    authorsMapping: '',
  });
  const [recentSvnUrls, setRecentSvnUrls] = useState<string[]>([]);
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedMigrationForResume, setSelectedMigrationForResume] = useState<Migration | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadMigrations = async () => {
    setLoading(true);
    try {
      const data = await gitlabService.getMigrations();
      setMigrations(data);
      
      // Extract unique SVN URLs for recent list
      const urls = [...new Set(data.map(m => m.svn_url))].slice(0, 5);
      setRecentSvnUrls(urls);
    } catch (error) {
      console.error('Failed to load migrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMigrations();
    const interval = setInterval(loadMigrations, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setMigrations((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAction = async (action: string, migration: Migration) => {
    switch (action) {
      case 'stop':
        if (window.confirm('실행 중인 마이그레이션을 중지하시겠습니까?')) {
          await gitlabService.stopMigration(migration.id);
          await loadMigrations();
        }
        break;
      case 'resume':
        setSelectedMigrationForResume(migration);
        setResumeDialogOpen(true);
        break;
      case 'sync':
        await gitlabService.syncMigration(migration.id);
        await loadMigrations();
        break;
      case 'delete':
        if (window.confirm('이 마이그레이션을 삭제하시겠습니까?')) {
          await gitlabService.deleteMigration(migration.id);
          await loadMigrations();
        }
        break;
    }
  };

  const handleQuickStart = async () => {
    try {
      // Create project and start migration
      const projectPath = quickStartForm.projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Here you would call the API to create project and start migration
      // For now, we'll just close the dialog
      setQuickStartOpen(false);
      setQuickStartForm({ svnUrl: '', projectName: '', authorsMapping: '' });
      await loadMigrations();
    } catch (error) {
      console.error('Failed to start migration:', error);
    }
  };

  const groupedMigrations = useMemo(() => {
    const filtered = migrations.filter(m => {
      const matchesFilter = filterStatus === 'all' || m.status === filterStatus;
      const matchesSearch = searchQuery === '' || 
        m.metadata?.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.svn_url.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return {
      running: filtered.filter(m => m.status === 'running' || m.status === 'syncing'),
      pending: filtered.filter(m => m.status === 'pending'),
      completed: filtered.filter(m => m.status === 'completed'),
      failed: filtered.filter(m => m.status === 'failed' || m.status === 'cancelled'),
    };
  }, [migrations, filterStatus, searchQuery]);

  const stats = {
    total: migrations.length,
    running: groupedMigrations.running.length,
    completed: groupedMigrations.completed.length,
    failed: groupedMigrations.failed.length,
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            마이그레이션 대시보드
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip icon={<Speed />} label={`진행 중: ${stats.running}`} color="primary" />
            <Chip icon={<CheckCircle />} label={`완료: ${stats.completed}`} color="success" />
            <Chip icon={<Error />} label={`실패: ${stats.failed}`} color="error" />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setQuickStartOpen(true)}
          >
            빠른 시작
          </Button>
          <IconButton onClick={loadMigrations} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Quick Start Panel */}
      <Collapse in={quickStartOpen}>
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
          <Typography variant="h6" gutterBottom>
            <Lightbulb sx={{ verticalAlign: 'bottom', mr: 1 }} />
            빠른 마이그레이션 시작
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Autocomplete
              freeSolo
              options={recentSvnUrls}
              value={quickStartForm.svnUrl}
              onChange={(_, value) => setQuickStartForm({ ...quickStartForm, svnUrl: value || '' })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="SVN URL"
                  placeholder="https://svn.example.com/repos/project"
                  size="small"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Link />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              sx={{ flex: 2 }}
            />
            <TextField
              label="프로젝트 이름"
              value={quickStartForm.projectName}
              onChange={(e) => setQuickStartForm({ ...quickStartForm, projectName: e.target.value })}
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleQuickStart}
              disabled={!quickStartForm.svnUrl || !quickStartForm.projectName}
            >
              시작
            </Button>
            <Button onClick={() => setQuickStartOpen(false)}>
              취소
            </Button>
          </Box>
          {recentSvnUrls.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <History fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                최근 사용: {recentSvnUrls[0]}
              </Typography>
            </Box>
          )}
        </Paper>
      </Collapse>

      {/* Search and Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="프로젝트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>상태 필터</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="상태 필터"
            startAdornment={<FilterList sx={{ ml: 1, mr: -0.5 }} />}
          >
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="running">진행 중</MenuItem>
            <MenuItem value="completed">완료</MenuItem>
            <MenuItem value="failed">실패</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Kanban Board */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* Running Column */}
          <Paper sx={{ flex: '1 1 300px', minWidth: 300, p: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Badge badgeContent={groupedMigrations.running.length} color="primary">
                <Typography variant="h6">진행 중</Typography>
              </Badge>
            </Box>
            <SortableContext
              items={groupedMigrations.running.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupedMigrations.running.map((migration) => (
                <MigrationCard
                  key={migration.id}
                  migration={migration}
                  onAction={handleAction}
                  onShowDetails={(id) => {
                    setSelectedMigration(id);
                    setDetailsOpen(true);
                  }}
                />
              ))}
            </SortableContext>
            {groupedMigrations.running.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                진행 중인 작업이 없습니다
              </Typography>
            )}
          </Paper>

          {/* Pending Column */}
          <Paper sx={{ flex: '1 1 300px', minWidth: 300, p: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Badge badgeContent={groupedMigrations.pending.length} color="default">
                <Typography variant="h6">대기 중</Typography>
              </Badge>
            </Box>
            <SortableContext
              items={groupedMigrations.pending.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupedMigrations.pending.map((migration) => (
                <MigrationCard
                  key={migration.id}
                  migration={migration}
                  onAction={handleAction}
                  onShowDetails={(id) => {
                    setSelectedMigration(id);
                    setDetailsOpen(true);
                  }}
                />
              ))}
            </SortableContext>
            {groupedMigrations.pending.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                대기 중인 작업이 없습니다
              </Typography>
            )}
          </Paper>

          {/* Completed Column */}
          <Paper sx={{ flex: '1 1 300px', minWidth: 300, p: 2, bgcolor: 'success.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Badge badgeContent={groupedMigrations.completed.length} color="success">
                <Typography variant="h6">완료</Typography>
              </Badge>
            </Box>
            <SortableContext
              items={groupedMigrations.completed.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupedMigrations.completed.map((migration) => (
                <MigrationCard
                  key={migration.id}
                  migration={migration}
                  onAction={handleAction}
                  onShowDetails={(id) => {
                    setSelectedMigration(id);
                    setDetailsOpen(true);
                  }}
                />
              ))}
            </SortableContext>
            {groupedMigrations.completed.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                완료된 작업이 없습니다
              </Typography>
            )}
          </Paper>

          {/* Failed Column */}
          <Paper sx={{ flex: '1 1 300px', minWidth: 300, p: 2, bgcolor: 'error.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Badge badgeContent={groupedMigrations.failed.length} color="error">
                <Typography variant="h6">실패/재시도 필요</Typography>
              </Badge>
            </Box>
            <SortableContext
              items={groupedMigrations.failed.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupedMigrations.failed.map((migration) => (
                <MigrationCard
                  key={migration.id}
                  migration={migration}
                  onAction={handleAction}
                  onShowDetails={(id) => {
                    setSelectedMigration(id);
                    setDetailsOpen(true);
                  }}
                />
              ))}
            </SortableContext>
            {groupedMigrations.failed.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                실패한 작업이 없습니다
              </Typography>
            )}
            {groupedMigrations.failed.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  💡 팁: 인증 오류는 SVN 계정 정보를 확인하세요
                </Typography>
              </Alert>
            )}
          </Paper>
        </DndContext>
      </Box>

      {/* Loading indicator */}
      {loading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0 }} />}

      {/* Details Dialog */}
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

      {/* Resume Dialog */}
      {selectedMigrationForResume && (
        <ResumeMigrationDialog
          open={resumeDialogOpen}
          onClose={() => {
            setResumeDialogOpen(false);
            setSelectedMigrationForResume(null);
          }}
          migration={selectedMigrationForResume}
          onResume={() => {
            setResumeDialogOpen(false);
            setSelectedMigrationForResume(null);
            loadMigrations();
          }}
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
        `}
      </style>
    </Box>
  );
};

export default MigrationMonitorKanban;