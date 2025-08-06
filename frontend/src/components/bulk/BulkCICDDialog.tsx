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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TextField,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import axios from 'axios';
import { useNotification } from '../../hooks/useNotification';

interface BulkCICDDialogProps {
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

interface CICDVariable {
  key: string;
  value: string;
  protected: boolean;
  masked: boolean;
  environment_scope?: string;
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

export const BulkCICDDialog: React.FC<BulkCICDDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  // Settings Sync State
  const [sourceProjectId, setSourceProjectId] = useState<string>('');
  const [syncGeneralSettings, setSyncGeneralSettings] = useState(true);
  const [syncVariables, setSyncVariables] = useState(true);
  const [overwriteVariables, setOverwriteVariables] = useState(false);
  const [sourceSettings, setSourceSettings] = useState<any>(null);
  
  // Variables State
  const [variables, setVariables] = useState<CICDVariable[]>([
    { key: '', value: '', protected: false, masked: false }
  ]);
  const [variableAction, setVariableAction] = useState<'add' | 'update' | 'delete'>('add');
  
  // Auto DevOps State
  const [autoDevOpsEnabled, setAutoDevOpsEnabled] = useState(true);
  
  const { showSuccess, showError } = useNotification();

  // Filter only projects (CI/CD settings only apply to projects)
  const projects = selectedItems.filter(item => item.type === 'project');

  // Load source project settings when selected
  useEffect(() => {
    if (sourceProjectId && tab === 0) {
      loadSourceSettings();
    }
  }, [sourceProjectId]);

  const loadSourceSettings = async () => {
    if (!sourceProjectId) return;
    
    try {
      const response = await axios.get(
        `/api/cicd/project/${sourceProjectId}/settings`,
        { withCredentials: true }
      );
      setSourceSettings(response.data);
    } catch (error) {
      showError('Failed to load source project settings');
    }
  };

  const handleSyncSettings = async () => {
    if (!sourceProjectId) {
      showError('소스 프로젝트를 선택해주세요');
      return;
    }

    const targetProjectIds = projects
      .map(p => parseInt(p.id.replace('project-', '')))
      .filter(id => id !== parseInt(sourceProjectId));

    if (targetProjectIds.length === 0) {
      showError('동기화할 대상 프로젝트가 없습니다');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/cicd/sync-settings', {
        sourceProjectId: parseInt(sourceProjectId),
        targetProjectIds,
        syncOptions: {
          syncGeneralSettings,
          syncVariables,
          overwriteVariables
        }
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트에 CI/CD 설정이 동기화되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 동기화 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'CI/CD 설정 동기화 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkVariables = async () => {
    const validVariables = variables.filter(v => v.key && v.value);
    if (validVariables.length === 0) {
      showError('최소 하나의 유효한 변수를 입력해주세요');
      return;
    }

    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    setLoading(true);
    try {
      const response = await axios.post('/api/cicd/bulk-variables', {
        projectIds,
        variables: validVariables,
        action: variableAction
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트에 변수가 ${
          variableAction === 'delete' ? '삭제' : variableAction === 'update' ? '업데이트' : '추가'
        }되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 작업 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || '변수 작업 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDevOps = async () => {
    const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

    setLoading(true);
    try {
      const response = await axios.post('/api/cicd/auto-devops', {
        projectIds,
        enabled: autoDevOpsEnabled
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`${response.data.results.successful.length}개 프로젝트의 Auto DevOps가 ${
          autoDevOpsEnabled ? '활성화' : '비활성화'
        }되었습니다`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`${response.data.results.failed.length}개 프로젝트 작업 실패`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Auto DevOps 설정 실패');
    } finally {
      setLoading(false);
    }
  };

  const addVariable = () => {
    setVariables([...variables, { key: '', value: '', protected: false, masked: false }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof CICDVariable, value: any) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const handleClose = () => {
    if (!loading) {
      setResults(null);
      setSourceProjectId('');
      setSourceSettings(null);
      setVariables([{ key: '', value: '', protected: false, masked: false }]);
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
          <SettingsIcon />
          <Typography variant="h6">CI/CD 설정 관리</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {projects.length}개 프로젝트의 CI/CD 설정을 관리합니다
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {projects.length === 0 ? (
          <Alert severity="warning">
            CI/CD 설정은 프로젝트에만 적용됩니다. 프로젝트를 선택해주세요.
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
                {results.failed?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="error">
                      실패 항목:
                    </Typography>
                    <List dense>
                      {results.failed.slice(0, 3).map((item: any, index: number) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={`프로젝트 ${item.id}`}
                            secondary={item.error}
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
                  <Tab label="설정 동기화" icon={<SyncIcon />} />
                  <Tab label="변수 관리" icon={<CodeIcon />} />
                  <Tab label="Auto DevOps" icon={<AutorenewIcon />} />
                </Tabs>

                {/* Settings Sync Tab */}
                <TabPanel value={tab} index={0}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>소스 프로젝트</InputLabel>
                    <Select
                      value={sourceProjectId}
                      onChange={(e) => setSourceProjectId(e.target.value)}
                      label="소스 프로젝트"
                    >
                      {projects.map(project => (
                        <MenuItem 
                          key={project.id} 
                          value={project.id.replace('project-', '')}
                        >
                          {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {sourceSettings && (
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>소스 프로젝트 설정 미리보기</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>일반 설정</Typography>
                          <List dense>
                            <ListItem>
                              <ListItemText 
                                primary="Auto DevOps"
                                secondary={sourceSettings.project.auto_devops_enabled ? '활성화' : '비활성화'}
                              />
                            </ListItem>
                            <ListItem>
                              <ListItemText 
                                primary="CI 설정 경로"
                                secondary={sourceSettings.project.ci_config_path || '.gitlab-ci.yml'}
                              />
                            </ListItem>
                            <ListItem>
                              <ListItemText 
                                primary="빌드 타임아웃"
                                secondary={`${sourceSettings.project.build_timeout || 3600}초`}
                              />
                            </ListItem>
                          </List>

                          {sourceSettings.variables.length > 0 && (
                            <>
                              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                변수 ({sourceSettings.variables.length}개)
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {sourceSettings.variables.map((v: any) => (
                                  <Chip 
                                    key={v.key}
                                    label={v.key}
                                    size="small"
                                    icon={v.protected ? <LockIcon /> : undefined}
                                  />
                                ))}
                              </Box>
                            </>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>동기화 옵션</Typography>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={syncGeneralSettings}
                          onChange={(e) => setSyncGeneralSettings(e.target.checked)}
                        />
                      }
                      label="일반 CI/CD 설정 동기화"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={syncVariables}
                          onChange={(e) => setSyncVariables(e.target.checked)}
                        />
                      }
                      label="CI/CD 변수 동기화"
                    />
                    {syncVariables && (
                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={overwriteVariables}
                            onChange={(e) => setOverwriteVariables(e.target.checked)}
                          />
                        }
                        label="기존 변수 덮어쓰기"
                        sx={{ ml: 4 }}
                      />
                    )}
                  </Box>

                  <Alert severity="info">
                    {sourceProjectId ? 
                      `${projects.length - 1}개 프로젝트에 설정이 동기화됩니다` :
                      '소스 프로젝트를 선택하면 다른 프로젝트에 설정이 복사됩니다'
                    }
                  </Alert>
                </TabPanel>

                {/* Variables Tab */}
                <TabPanel value={tab} index={1}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>작업 유형</InputLabel>
                    <Select
                      value={variableAction}
                      onChange={(e) => setVariableAction(e.target.value as any)}
                      label="작업 유형"
                    >
                      <MenuItem value="add">변수 추가</MenuItem>
                      <MenuItem value="update">변수 업데이트</MenuItem>
                      <MenuItem value="delete">변수 삭제</MenuItem>
                    </Select>
                  </FormControl>

                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>변수 이름</TableCell>
                          <TableCell>값</TableCell>
                          <TableCell align="center">Protected</TableCell>
                          <TableCell align="center">Masked</TableCell>
                          <TableCell width={50}></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {variables.map((variable, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <TextField
                                size="small"
                                value={variable.key}
                                onChange={(e) => updateVariable(index, 'key', e.target.value)}
                                placeholder="VARIABLE_NAME"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={variable.value}
                                onChange={(e) => updateVariable(index, 'value', e.target.value)}
                                placeholder="value"
                                fullWidth
                                type={variable.masked ? 'password' : 'text'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={variable.protected}
                                onChange={(e) => updateVariable(index, 'protected', e.target.checked)}
                                icon={<LockIcon />}
                                checkedIcon={<LockIcon color="primary" />}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={variable.masked}
                                onChange={(e) => updateVariable(index, 'masked', e.target.checked)}
                                icon={<VisibilityOffIcon />}
                                checkedIcon={<VisibilityOffIcon color="primary" />}
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton 
                                size="small"
                                onClick={() => removeVariable(index)}
                                disabled={variables.length === 1}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Button
                    startIcon={<AddIcon />}
                    onClick={addVariable}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  >
                    변수 추가
                  </Button>

                  <Alert severity="info">
                    {projects.length}개 프로젝트에 {variables.filter(v => v.key).length}개 변수가 
                    {variableAction === 'delete' ? ' 삭제' : variableAction === 'update' ? ' 업데이트' : ' 추가'}됩니다
                  </Alert>
                </TabPanel>

                {/* Auto DevOps Tab */}
                <TabPanel value={tab} index={2}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Auto DevOps는 GitLab이 자동으로 CI/CD 파이프라인을 구성하는 기능입니다.
                  </Alert>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Auto DevOps 설정</InputLabel>
                    <Select
                      value={autoDevOpsEnabled ? 'enable' : 'disable'}
                      onChange={(e) => setAutoDevOpsEnabled(e.target.value === 'enable')}
                      label="Auto DevOps 설정"
                    >
                      <MenuItem value="enable">활성화</MenuItem>
                      <MenuItem value="disable">비활성화</MenuItem>
                    </Select>
                  </FormControl>

                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CodeIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="대상 프로젝트"
                        secondary={`${projects.length}개 프로젝트`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AutorenewIcon color={autoDevOpsEnabled ? "primary" : "disabled"} />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Auto DevOps"
                        secondary={autoDevOpsEnabled ? '활성화 예정' : '비활성화 예정'}
                      />
                    </ListItem>
                  </List>

                  <Alert severity="warning">
                    Auto DevOps를 활성화하면 .gitlab-ci.yml 파일이 없는 프로젝트에 
                    자동으로 파이프라인이 구성됩니다.
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
                onClick={handleSyncSettings} 
                variant="contained" 
                disabled={loading || !sourceProjectId}
                startIcon={<SyncIcon />}
              >
                설정 동기화
              </Button>
            )}
            {tab === 1 && (
              <Button 
                onClick={handleBulkVariables} 
                variant="contained" 
                disabled={loading || !variables.some(v => v.key && v.value)}
                startIcon={<CodeIcon />}
              >
                변수 {variableAction === 'delete' ? '삭제' : variableAction === 'update' ? '업데이트' : '추가'}
              </Button>
            )}
            {tab === 2 && (
              <Button 
                onClick={handleAutoDevOps} 
                variant="contained" 
                disabled={loading}
                startIcon={<AutorenewIcon />}
              >
                Auto DevOps {autoDevOpsEnabled ? '활성화' : '비활성화'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};