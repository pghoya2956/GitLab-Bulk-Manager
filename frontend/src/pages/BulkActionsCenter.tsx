import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  LinearProgress,
  Chip,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Divider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  ContentCopy as CloneIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Visibility as VisibilityIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  Rule as RuleIcon,
  Group as GroupIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Webhook as WebhookIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BulkImportDialog } from '../components/bulk/BulkImportDialog';
import { BulkDeleteDialog } from '../components/bulk/BulkDeleteDialog';
import { BulkTransferDialog } from '../components/bulk/BulkTransferDialog';
import { BulkSettingsDialog } from '../components/bulk/BulkSettingsDialog';
import { BulkArchiveDialog } from '../components/bulk/BulkArchiveDialog';
import { BulkUnarchiveDialog } from '../components/bulk/BulkUnarchiveDialog';
import { BulkCloneDialog } from '../components/bulk/BulkCloneDialog';
import { BulkMembersDialog } from '../components/bulk/BulkMembersDialog';
import { BulkCICDDialog } from '../components/bulk/BulkCICDDialog';
import { BulkIssuesDialog } from '../components/bulk/BulkIssuesDialog';
import { useNotification } from '../hooks/useNotification';
import { GitLabTree } from '../components/GitLabTree';
import axios from 'axios';

interface ActionCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  category: 'resource' | 'settings' | 'advanced';
  description: string;
  implemented: boolean;
}

interface RecentAction {
  id: string;
  type: string;
  status: 'success' | 'error' | 'running';
  message: string;
  timestamp: Date;
  progress?: number;
}

const BulkActionsCenter: React.FC = () => {
  const navigate = useNavigate();
  const { showInfo } = useNotification();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  const multiSelect = true;
  
  // Dialog states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [cicdDialogOpen, setCicdDialogOpen] = useState(false);
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);

  // Real action history from localStorage or backend
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);

  // Load groups and action history on mount
  useEffect(() => {
    loadGroups();
    loadActionHistory();
  }, []);
  
  // Debug logging
  useEffect(() => {
    console.log('Recent actions updated:', recentActions);
  }, [recentActions]);

  const loadActionHistory = () => {
    // Load from localStorage
    const savedHistory = localStorage.getItem('bulkActionHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setRecentActions(history);
      } catch (error) {
        console.error('Failed to load action history:', error);
      }
    }
  };

  const addActionToHistory = (action: Omit<RecentAction, 'id' | 'timestamp'>) => {
    const newAction: RecentAction = {
      ...action,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    
    setRecentActions(prevActions => {
      const updatedHistory = [newAction, ...prevActions].slice(0, 50); // Keep last 50 actions
      localStorage.setItem('bulkActionHistory', JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/gitlab/groups', {
        params: { per_page: 100 },
        withCredentials: true
      });
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionCards: ActionCard[] = [
    // Resource Management
    {
      id: 'create',
      title: '생성',
      icon: <AddIcon />,
      color: '#4CAF50',
      category: 'resource',
      description: 'YAML 기반 대량 생성',
      implemented: true,
    },
    {
      id: 'delete',
      title: '삭제',
      icon: <DeleteIcon />,
      color: '#F44336',
      category: 'resource',
      description: '선택 항목 일괄 삭제',
      implemented: true,
    },
    {
      id: 'transfer',
      title: '이동',
      icon: <MoveIcon />,
      color: '#FF9800',
      category: 'resource',
      description: '다른 그룹으로 이동',
      implemented: true,
    },
    {
      id: 'clone',
      title: '복제',
      icon: <CloneIcon />,
      color: '#9C27B0',
      category: 'resource',
      description: '구조와 설정 복제',
      implemented: true,
    },
    {
      id: 'archive',
      title: '아카이브',
      icon: <ArchiveIcon />,
      color: '#607D8B',
      category: 'resource',
      description: '프로젝트 아카이브',
      implemented: true,
    },
    {
      id: 'unarchive',
      title: '아카이브 해제',
      icon: <UnarchiveIcon />,
      color: '#795548',
      category: 'resource',
      description: '아카이브 해제',
      implemented: true,
    },
    // Settings & Configuration
    {
      id: 'settings',
      title: '설정 변경',
      icon: <VisibilityIcon />,
      color: '#2196F3',
      category: 'settings',
      description: '가시성, 설명 등',
      implemented: true,
    },
    {
      id: 'members',
      title: '멤버 관리',
      icon: <GroupIcon />,
      color: '#00BCD4',
      category: 'settings',
      description: '멤버 추가/제거/권한',
      implemented: true,
    },
    {
      id: 'protection',
      title: '보호 규칙',
      icon: <ShieldIcon />,
      color: '#FF5722',
      category: 'settings',
      description: '브랜치/태그 보호',
      implemented: false,
    },
    {
      id: 'cicd',
      title: 'CI/CD 설정',
      icon: <CodeIcon />,
      color: '#3F51B5',
      category: 'settings',
      description: '파이프라인 설정 동기화',
      implemented: true,
    },
    // Advanced Features
    {
      id: 'security',
      title: '보안 스캔',
      icon: <SecurityIcon />,
      color: '#E91E63',
      category: 'advanced',
      description: '취약점 스캔',
      implemented: false,
    },
    {
      id: 'compliance',
      title: '컴플라이언스',
      icon: <RuleIcon />,
      color: '#009688',
      category: 'advanced',
      description: '규정 준수 체크',
      implemented: false,
    },
    {
      id: 'issues',
      title: '이슈/MR',
      icon: <BugReportIcon />,
      color: '#FFC107',
      category: 'advanced',
      description: '이슈 및 MR 관리',
      implemented: true,
    },
    {
      id: 'webhooks',
      title: '웹훅',
      icon: <WebhookIcon />,
      color: '#673AB7',
      category: 'advanced',
      description: '웹훅 일괄 설정',
      implemented: false,
    },
  ];

  const handleActionClick = (actionId: string) => {
    if (selectedItems.length === 0 && actionId !== 'create') {
      showInfo('먼저 작업할 항목을 선택해주세요');
      return;
    }

    switch (actionId) {
      case 'create':
        setImportDialogOpen(true);
        break;
      case 'delete':
        setDeleteDialogOpen(true);
        break;
      case 'transfer':
        setTransferDialogOpen(true);
        break;
      case 'settings':
        setSettingsDialogOpen(true);
        break;
      case 'archive':
        setArchiveDialogOpen(true);
        break;
      case 'unarchive':
        setUnarchiveDialogOpen(true);
        break;
      case 'clone':
        setCloneDialogOpen(true);
        break;
      case 'members':
        setMembersDialogOpen(true);
        break;
      case 'cicd':
        setCicdDialogOpen(true);
        break;
      case 'issues':
        setIssuesDialogOpen(true);
        break;
      default:
        showInfo(`${actionId} 기능은 준비 중입니다`);
    }
  };

  const handleSelectionChange = (selected: any[]) => {
    setSelectedItems(selected);
  };

  const getStatusIcon = (status: RecentAction['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'running':
        return <ScheduleIcon color="action" />;
    }
  };

  const renderCategory = (category: string, cards: ActionCard[]) => {
    const categoryTitles = {
      resource: '리소스 관리',
      settings: '설정 및 구성',
      advanced: '고급 기능',
    };

    return (
      <Box key={category} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
          {categoryTitles[category as keyof typeof categoryTitles]}
        </Typography>
        <Grid container spacing={2}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={card.id}>
              <Card
                sx={{
                  height: '100%',
                  opacity: card.implemented ? 1 : 0.5,
                  transition: 'all 0.3s',
                  '&:hover': card.implemented ? {
                    transform: 'translateY(-4px)',
                    boxShadow: 3,
                  } : {},
                }}
              >
                <CardActionArea
                  onClick={() => card.implemented && handleActionClick(card.id)}
                  disabled={!card.implemented}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box
                        sx={{
                          color: card.color,
                          display: 'flex',
                          alignItems: 'center',
                          mr: 2,
                        }}
                      >
                        {card.icon}
                      </Box>
                      <Typography variant="h6">{card.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                    {!card.implemented && (
                      <Chip label="준비중" size="small" sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)', bgcolor: 'background.default' }}>
      <Box sx={{ flex: 1, px: 3, py: 3, overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Bulk Actions Center
          </Typography>
          <Typography variant="body1" color="text.secondary">
            여러 프로젝트와 그룹에 대한 일괄 작업을 수행합니다
          </Typography>
        </Box>

        {/* Groups/Projects Tree Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">그룹 및 프로젝트 선택</Typography>
            <Box>
              <IconButton onClick={() => setRefreshTrigger(prev => prev + 1)} size="small">
                <RefreshIcon />
              </IconButton>
              <Chip 
                label={`${selectedItems.length}개 선택됨`} 
                color="primary" 
                size="small"
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>
          
          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="그룹 또는 프로젝트 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          {/* Tree View */}
          <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
            <GitLabTree 
              onSelect={() => {}} // Disable selection on click
              checkedNodes={selectedItems.map((item: any) => {
                // item.id는 이미 'group-123' 또는 'project-456' 형식일 수 있음
                if (typeof item.id === 'string' && item.id.includes('-')) {
                  return item.id;
                }
                return `${item.type}-${item.id}`;
              })}
              onCheckedNodesChange={(nodeIds: string[], nodes?: any[]) => {
                if (nodes) {
                  handleSelectionChange(nodes);
                }
              }}
              expanded={expanded}
              onExpandedChange={setExpanded}
              multiSelect={true}
              searchTerm={searchTerm}
              refreshTrigger={refreshTrigger}
            />
          </Box>
        </Paper>

        {/* Action Cards */}
        {Object.entries(
          actionCards.reduce((acc, card) => {
            if (!acc[card.category]) acc[card.category] = [];
            acc[card.category].push(card);
            return acc;
          }, {} as Record<string, ActionCard[]>)
        ).map(([category, cards]) => renderCategory(category, cards))}

      </Box>

      {/* Right Sidebar - Recent Actions History */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          borderLeft: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'auto',
          height: 'calc(100vh - 64px)',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">최근 작업 히스토리</Typography>
            <Badge
              badgeContent={recentActions.filter(a => a.status === 'running').length}
              color="error"
              sx={{ ml: 'auto' }}
            >
              <HistoryIcon />
            </Badge>
          </Box>
            
            <List>
              {recentActions.map((action) => (
                <React.Fragment key={action.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      {getStatusIcon(action.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={action.type}
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {action.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(action.timestamp).toLocaleTimeString()}
                          </Typography>
                          {action.status === 'running' && action.progress && (
                            <LinearProgress
                              variant="determinate"
                              value={action.progress}
                              sx={{ mt: 1 }}
                            />
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>

            {recentActions.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  최근 작업 내역이 없습니다
                </Typography>
              </Box>
            )}
        </Box>
      </Box>

      {/* Dialogs */}
      <BulkImportDialog 
        open={importDialogOpen} 
        onClose={() => setImportDialogOpen(false)}
        onSuccess={(result: any) => {
          setImportDialogOpen(false);
          addActionToHistory({
            type: '생성',
            status: 'success',
            message: `YAML 기반 대량 생성 완료`
          });
          showInfo('생성 작업이 완료되었습니다');
        }}
      />
      <BulkDeleteDialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={(result: any) => {
          setDeleteDialogOpen(false);
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          addActionToHistory({
            type: '삭제',
            status: result.failed.length === 0 ? 'success' : 'error',
            message: `${result.success.length}개 항목 삭제 ${result.failed.length > 0 ? `(실패: ${result.failed.length}개)` : '완료'}`
          });
          showInfo('삭제 작업이 완료되었습니다');
        }}
      />
      <BulkTransferDialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={(result: any) => {
          setTransferDialogOpen(false);
          
          // 이동된 항목의 parent group을 찾아서 펼치기
          const expandedGroups = new Set(expanded);
          selectedItems.forEach((item: any) => {
            // 기존 부모 그룹 추가
            if (item.namespace?.id) {
              expandedGroups.add(`group-${item.namespace.id}`);
            }
            if (item.parent_id) {
              expandedGroups.add(`group-${item.parent_id}`);
            }
          });
          
          // 새로운 대상 그룹도 펼치기 (result에서 targetNamespaceId 가져오기)
          if (result?.success?.length > 0 && result.success[0].newNamespaceId) {
            expandedGroups.add(`group-${result.success[0].newNamespaceId}`);
          }
          
          setExpanded(Array.from(expandedGroups));
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          
          const successCount = result?.success?.length || 0;
          const failedCount = result?.failed?.length || 0;
          
          addActionToHistory({
            type: '이동',
            status: failedCount === 0 ? 'success' : 'warning',
            message: `${successCount}개 항목 이동 완료${failedCount > 0 ? ` (실패: ${failedCount}개)` : ''}`
          });
          showInfo(`${successCount}개 항목이 새 네임스페이스로 이동되었습니다`);
        }}
      />
      <BulkSettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setSettingsDialogOpen(false);
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          addActionToHistory({
            type: '설정 변경',
            status: 'success',
            message: `${selectedItems.length}개 항목 설정 변경 완료`
          });
          showInfo('설정이 성공적으로 변경되었습니다');
        }}
      />
      <BulkArchiveDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setArchiveDialogOpen(false);
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          addActionToHistory({
            type: '아카이브',
            status: 'success',
            message: `${selectedItems.length}개 프로젝트 아카이브 완료`
          });
          showInfo('아카이브가 완료되었습니다');
        }}
      />
      <BulkUnarchiveDialog
        open={unarchiveDialogOpen}
        onClose={() => setUnarchiveDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setUnarchiveDialogOpen(false);
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          addActionToHistory({
            type: '아카이브 해제',
            status: 'success',
            message: `${selectedItems.length}개 프로젝트 아카이브 해제 완료`
          });
          showInfo('아카이브 해제가 완료되었습니다');
        }}
      />
      <BulkCloneDialog
        open={cloneDialogOpen}
        onClose={() => setCloneDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setCloneDialogOpen(false);
          setSelectedItems([]);
          setRefreshTrigger(prev => prev + 1);
          addActionToHistory({
            type: '복제',
            status: 'success',
            message: `${selectedItems.length}개 항목 복제 완료`
          });
          showInfo('복제가 완료되었습니다');
        }}
      />
      <BulkMembersDialog
        open={membersDialogOpen}
        onClose={() => setMembersDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setMembersDialogOpen(false);
          addActionToHistory({
            type: '멤버 관리',
            status: 'success',
            message: `${selectedItems.length}개 항목 멤버 설정 완료`
          });
          showInfo('멤버 관리가 완료되었습니다');
        }}
      />
      <BulkCICDDialog
        open={cicdDialogOpen}
        onClose={() => setCicdDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setCicdDialogOpen(false);
          addActionToHistory({
            type: 'CI/CD 설정',
            status: 'success',
            message: `${selectedItems.length}개 프로젝트 CI/CD 설정 동기화 완료`
          });
          showInfo('CI/CD 설정이 동기화되었습니다');
        }}
      />
      <BulkIssuesDialog
        open={issuesDialogOpen}
        onClose={() => setIssuesDialogOpen(false)}
        selectedItems={selectedItems}
        onSuccess={() => {
          setIssuesDialogOpen(false);
          addActionToHistory({
            type: '이슈/MR 관리',
            status: 'success',
            message: `${selectedItems.length}개 프로젝트 이슈/MR 작업 완료`
          });
          showInfo('이슈/MR 작업이 완료되었습니다');
        }}
      />
    </Box>
  );
};

export default BulkActionsCenter;