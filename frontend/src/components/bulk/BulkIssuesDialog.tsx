import React, { useState, useEffect } from 'react';
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
  ListItemText,
  ListItemIcon,
  Box,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
  Autocomplete,
  Grid,
  Paper,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LabelIcon from '@mui/icons-material/Label';
import axios from 'axios';
import { useNotification } from '../../hooks/useNotification';

interface BulkIssuesDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: (result?: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const BulkIssuesDialog: React.FC<BulkIssuesDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  // Issue Creation State
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueLabels, setIssueLabels] = useState<string[]>([]);
  const [issueAssignees] = useState<any[]>([]);
  const [issueMilestone, setIssueMilestone] = useState('');
  const [issueDueDate, setIssueDueDate] = useState('');
  const [issueConfidential, setIssueConfidential] = useState(false);
  
  // Issue Update State
  const [updateAction, setUpdateAction] = useState<'close' | 'reopen' | 'update'>('update');
  const [updateLabelsAction, setUpdateLabelsAction] = useState<'replace' | 'add' | 'remove'>('add');
  const [updateLabels, setUpdateLabels] = useState<string[]>([]);
  const [updateMilestone, setUpdateMilestone] = useState('');
  const [updateAssignees] = useState<any[]>([]);
  
  // MR Creation State
  const [mrTitle, setMrTitle] = useState('');
  const [mrDescription, setMrDescription] = useState('');
  const [mrSourceBranch, setMrSourceBranch] = useState('');
  const [mrTargetBranch, setMrTargetBranch] = useState('main');
  const [mrLabels, setMrLabels] = useState<string[]>([]);
  const [mrAssignees] = useState<any[]>([]);
  const [mrMilestone, setMrMilestone] = useState('');
  const [mrRemoveSourceBranch, setMrRemoveSourceBranch] = useState(true);
  const [mrSquash, setMrSquash] = useState(false);
  
  // MR Merge State
  const [mergeSquash, setMergeSquash] = useState(false);
  const [mergeRemoveSource, setMergeRemoveSource] = useState(true);
  const [mergeWhenPipelineSucceeds, setMergeWhenPipelineSucceeds] = useState(false);
  const [mergeCommitMessage, setMergeCommitMessage] = useState('');
  
  // Available labels and milestones (loaded from first project)
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [availableMilestones, setAvailableMilestones] = useState<any[]>([]);
  
  const { showSuccess, showError } = useNotification();

  // Filter only projects (Issues/MRs only apply to projects)
  const projects = selectedItems.filter(item => item.type === 'project');

  // Load labels and milestones from first project
  useEffect(() => {
    if (open && projects.length > 0) {
      loadProjectMetadata();
    }
  }, [open]);

  const loadProjectMetadata = async () => {
    if (projects.length === 0) return;
    
    const firstProjectId = projects[0].id.replace('project-', '');
    
    try {
      // Load labels
      const labelsResponse = await axios.get(
        `/api/issues/project/${firstProjectId}/labels`,
        { withCredentials: true }
      );
      setAvailableLabels(labelsResponse.data.map((l: any) => l.name));
      
      // Load milestones
      const milestonesResponse = await axios.get(
        `/api/issues/project/${firstProjectId}/milestones`,
        { withCredentials: true }
      );
      setAvailableMilestones(milestonesResponse.data);
    } catch (error) {
      console.error('Failed to load project metadata:', error);
    }
  };

  const handleCreateIssues = async () => {
    if (!issueTitle) {
      showError('Issue 제목을 입력해주세요');
      return;
    }

    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    setLoading(true);
    try {
      const response = await axios.post('/api/issues/bulk-create', {
        projectIds,
        issue: {
          title: issueTitle,
          description: issueDescription,
          labels: issueLabels,
          assignee_ids: issueAssignees.map(a => a.id),
          milestone_id: issueMilestone ? parseInt(issueMilestone) : undefined,
          due_date: issueDueDate || undefined,
          confidential: issueConfidential
        }
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트에 Issue가 생성되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 생성 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Issue 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIssues = async () => {
    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    const updates: any = {};
    
    if (updateAction === 'close') {
      updates.state_event = 'close';
    } else if (updateAction === 'reopen') {
      updates.state_event = 'reopen';
    } else {
      if (updateLabels.length > 0) {
        if (updateLabelsAction === 'replace') {
          updates.labels = updateLabels;
        } else if (updateLabelsAction === 'add') {
          updates.add_labels = updateLabels;
        } else {
          updates.remove_labels = updateLabels;
        }
      }
      
      if (updateMilestone) {
        updates.milestone_id = parseInt(updateMilestone);
      }
      
      if (updateAssignees.length > 0) {
        updates.assignee_ids = updateAssignees.map(a => a.id);
      }
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/issues/bulk-update', {
        projectIds,
        updates
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트의 Issue가 업데이트되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 업데이트 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Issue 업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMRs = async () => {
    if (!mrTitle || !mrSourceBranch || !mrTargetBranch) {
      showError('MR 제목과 브랜치 정보를 입력해주세요');
      return;
    }

    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    setLoading(true);
    try {
      const response = await axios.post('/api/issues/merge-requests/bulk-create', {
        projectIds,
        mergeRequest: {
          title: mrTitle,
          description: mrDescription,
          source_branch: mrSourceBranch,
          target_branch: mrTargetBranch,
          labels: mrLabels,
          assignee_ids: mrAssignees.map(a => a.id),
          milestone_id: mrMilestone ? parseInt(mrMilestone) : undefined,
          remove_source_branch: mrRemoveSourceBranch,
          squash: mrSquash
        }
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트에 MR이 생성되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 생성 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'MR 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeMRs = async () => {
    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    setLoading(true);
    try {
      const response = await axios.post('/api/issues/merge-requests/bulk-merge', {
        projectIds,
        mergeOptions: {
          squash: mergeSquash,
          should_remove_source_branch: mergeRemoveSource,
          merge_when_pipeline_succeeds: mergeWhenPipelineSucceeds,
          merge_commit_message: mergeCommitMessage || undefined
        }
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트의 MR이 병합되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 병합 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'MR 병합 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResults(null);
      setIssueTitle('');
      setIssueDescription('');
      setIssueLabels([]);
      setMrTitle('');
      setMrDescription('');
      setMrSourceBranch('');
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon />
          <Typography variant="h6">Issues & MR 일괄 관리</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {projects.length}개 프로젝트의 Issues와 Merge Requests를 관리합니다
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {projects.length === 0 ? (
          <Alert severity="warning">
            Issues와 MR 관리는 프로젝트에만 적용됩니다. 프로젝트를 선택해주세요.
          </Alert>
        ) : (
          <>
            {loading && <LinearProgress sx={{ mb: 2 }} />}

            {results ? (
              <Alert 
                severity={results.failed?.length === 0 ? 'success' : 'warning'}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2">작업 완료</Typography>
                <Typography variant="body2">
                  성공: {results.successful?.length || 0} | 실패: {results.failed?.length || 0}
                </Typography>
                {results.successful?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <List dense>
                      {results.successful.slice(0, 3).map((item: any, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <CheckCircleIcon color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.name}
                            secondary={item.message}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Alert>
            ) : (
              <>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                  <Tab label="Issue 생성" icon={<AddIcon />} />
                  <Tab label="Issue 수정" icon={<EditIcon />} />
                  <Tab label="MR 생성" icon={<MergeTypeIcon />} />
                  <Tab label="MR 병합" icon={<CheckCircleIcon />} />
                </Tabs>

                {/* Issue Creation Tab */}
                <TabPanel value={tab} index={0}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Issue 제목"
                        value={issueTitle}
                        onChange={(e) => setIssueTitle(e.target.value)}
                        required
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="설명"
                        value={issueDescription}
                        onChange={(e) => setIssueDescription(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        multiple
                        options={availableLabels}
                        value={issueLabels}
                        onChange={(_, value) => setIssueLabels(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="라벨"
                            placeholder="라벨 선택"
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={option}
                              {...getTagProps({ index })}
                              icon={<LabelIcon />}
                              size="small"
                            />
                          ))
                        }
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>마일스톤</InputLabel>
                        <Select
                          value={issueMilestone}
                          onChange={(e) => setIssueMilestone(e.target.value)}
                          label="마일스톤"
                        >
                          <MenuItem value="">없음</MenuItem>
                          {availableMilestones.map(milestone => (
                            <MenuItem key={milestone.id} value={milestone.id}>
                              {milestone.title}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="마감일"
                        value={issueDueDate}
                        onChange={(e) => setIssueDueDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={issueConfidential}
                            onChange={(e) => setIssueConfidential(e.target.checked)}
                          />
                        }
                        label="비공개 Issue"
                      />
                    </Grid>
                  </Grid>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    {projects.length}개 프로젝트에 동일한 Issue가 생성됩니다
                  </Alert>
                </TabPanel>

                {/* Issue Update Tab */}
                <TabPanel value={tab} index={1}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>작업 유형</InputLabel>
                    <Select
                      value={updateAction}
                      onChange={(e) => setUpdateAction(e.target.value as any)}
                      label="작업 유형"
                    >
                      <MenuItem value="update">Issue 업데이트</MenuItem>
                      <MenuItem value="close">Issue 닫기</MenuItem>
                      <MenuItem value="reopen">Issue 다시 열기</MenuItem>
                    </Select>
                  </FormControl>

                  {updateAction === 'update' && (
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl fullWidth sx={{ mb: 1 }}>
                          <InputLabel>라벨 작업</InputLabel>
                          <Select
                            value={updateLabelsAction}
                            onChange={(e) => setUpdateLabelsAction(e.target.value as any)}
                            label="라벨 작업"
                          >
                            <MenuItem value="add">라벨 추가</MenuItem>
                            <MenuItem value="remove">라벨 제거</MenuItem>
                            <MenuItem value="replace">라벨 교체</MenuItem>
                          </Select>
                        </FormControl>
                        
                        <Autocomplete
                          multiple
                          options={availableLabels}
                          value={updateLabels}
                          onChange={(_, value) => setUpdateLabels(value)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={`${updateLabelsAction === 'add' ? '추가할' : updateLabelsAction === 'remove' ? '제거할' : '교체할'} 라벨`}
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                label={option}
                                {...getTagProps({ index })}
                                icon={<LabelIcon />}
                                size="small"
                              />
                            ))
                          }
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>마일스톤 변경</InputLabel>
                          <Select
                            value={updateMilestone}
                            onChange={(e) => setUpdateMilestone(e.target.value)}
                            label="마일스톤 변경"
                          >
                            <MenuItem value="">변경 안함</MenuItem>
                            <MenuItem value="0">마일스톤 제거</MenuItem>
                            {availableMilestones.map(milestone => (
                              <MenuItem key={milestone.id} value={milestone.id}>
                                {milestone.title}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  )}

                  <Alert severity="info" sx={{ mt: 2 }}>
                    {projects.length}개 프로젝트의 모든 열린 Issue가 {
                      updateAction === 'close' ? '닫힙니다' :
                      updateAction === 'reopen' ? '다시 열립니다' :
                      '업데이트됩니다'
                    }
                  </Alert>
                </TabPanel>

                {/* MR Creation Tab */}
                <TabPanel value={tab} index={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="MR 제목"
                        value={mrTitle}
                        onChange={(e) => setMrTitle(e.target.value)}
                        required
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="설명"
                        value={mrDescription}
                        onChange={(e) => setMrDescription(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="소스 브랜치"
                        value={mrSourceBranch}
                        onChange={(e) => setMrSourceBranch(e.target.value)}
                        required
                        placeholder="feature/new-feature"
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="타겟 브랜치"
                        value={mrTargetBranch}
                        onChange={(e) => setMrTargetBranch(e.target.value)}
                        required
                        placeholder="main"
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        multiple
                        options={availableLabels}
                        value={mrLabels}
                        onChange={(_, value) => setMrLabels(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="라벨"
                            placeholder="라벨 선택"
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={option}
                              {...getTagProps({ index })}
                              icon={<LabelIcon />}
                              size="small"
                            />
                          ))
                        }
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>마일스톤</InputLabel>
                        <Select
                          value={mrMilestone}
                          onChange={(e) => setMrMilestone(e.target.value)}
                          label="마일스톤"
                        >
                          <MenuItem value="">없음</MenuItem>
                          {availableMilestones.map(milestone => (
                            <MenuItem key={milestone.id} value={milestone.id}>
                              {milestone.title}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mrRemoveSourceBranch}
                            onChange={(e) => setMrRemoveSourceBranch(e.target.checked)}
                          />
                        }
                        label="병합 후 소스 브랜치 삭제"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mrSquash}
                            onChange={(e) => setMrSquash(e.target.checked)}
                          />
                        }
                        label="커밋 스쿼시"
                      />
                    </Grid>
                  </Grid>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    {projects.length}개 프로젝트에 동일한 MR이 생성됩니다
                  </Alert>
                </TabPanel>

                {/* MR Merge Tab */}
                <TabPanel value={tab} index={3}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    병합 가능한 상태의 모든 열린 MR이 자동으로 병합됩니다
                  </Alert>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="병합 커밋 메시지 (선택사항)"
                        value={mergeCommitMessage}
                        onChange={(e) => setMergeCommitMessage(e.target.value)}
                        placeholder="기본 메시지를 사용하려면 비워두세요"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mergeSquash}
                            onChange={(e) => setMergeSquash(e.target.checked)}
                          />
                        }
                        label="커밋 스쿼시"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mergeRemoveSource}
                            onChange={(e) => setMergeRemoveSource(e.target.checked)}
                          />
                        }
                        label="병합 후 소스 브랜치 삭제"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mergeWhenPipelineSucceeds}
                            onChange={(e) => setMergeWhenPipelineSucceeds(e.target.checked)}
                          />
                        }
                        label="파이프라인 성공 시 병합"
                      />
                    </Grid>
                  </Grid>

                  <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      병합 조건:
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="MR이 'can_be_merged' 상태여야 함" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="WIP/Draft MR은 자동 제외" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="충돌이 없어야 함" />
                      </ListItem>
                    </List>
                  </Paper>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    {projects.length}개 프로젝트의 열린 MR이 검토되어 병합됩니다
                  </Alert>
                </TabPanel>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {results ? '닫기' : '취소'}
        </Button>
        {!results && projects.length > 0 && (
          <>
            {tab === 0 && (
              <Button 
                onClick={handleCreateIssues} 
                variant="contained" 
                disabled={loading || !issueTitle}
                startIcon={<AddIcon />}
              >
                Issue 생성
              </Button>
            )}
            {tab === 1 && (
              <Button 
                onClick={handleUpdateIssues} 
                variant="contained" 
                disabled={loading}
                startIcon={<EditIcon />}
              >
                Issue {updateAction === 'close' ? '닫기' : updateAction === 'reopen' ? '열기' : '업데이트'}
              </Button>
            )}
            {tab === 2 && (
              <Button 
                onClick={handleCreateMRs} 
                variant="contained" 
                disabled={loading || !mrTitle || !mrSourceBranch || !mrTargetBranch}
                startIcon={<MergeTypeIcon />}
              >
                MR 생성
              </Button>
            )}
            {tab === 3 && (
              <Button 
                onClick={handleMergeMRs} 
                variant="contained" 
                disabled={loading}
                startIcon={<CheckCircleIcon />}
                color="success"
              >
                MR 병합
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};