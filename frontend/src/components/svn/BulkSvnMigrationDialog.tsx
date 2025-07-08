import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Close,
  Add,
  Delete,
  Upload,
  CheckCircle,
  Warning,
  PlayArrow,
} from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import yaml from 'js-yaml';

interface SvnRepository {
  id: string;
  svnUrl: string;
  svnUsername: string;
  svnPassword: string;
  projectName: string;
  projectPath: string;
  targetGroupId?: number;
  targetGroupPath?: string;
  layoutType: 'standard' | 'custom';
  customLayout?: {
    trunk: string;
    branches: string;
    tags: string;
  };
  status?: 'pending' | 'validating' | 'valid' | 'error';
  error?: string;
}

interface BulkSvnMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedGroup?: any;
}

const BulkSvnMigrationDialog: React.FC<BulkSvnMigrationDialogProps> = ({
  open,
  onClose,
  selectedGroup,
}) => {
  const gitlabUrl = useSelector((state: RootState) => state.auth.gitlabUrl);
  const [repositories, setRepositories] = useState<SvnRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, any>>({});

  // Add a single repository
  const addRepository = () => {
    const newRepo: SvnRepository = {
      id: Date.now().toString(),
      svnUrl: '',
      svnUsername: '',
      svnPassword: '',
      projectName: '',
      projectPath: '',
      targetGroupId: selectedGroup?.id,
      targetGroupPath: selectedGroup?.full_path,
      layoutType: 'standard',
      status: 'pending',
    };
    setRepositories([...repositories, newRepo]);
  };

  // Update repository field
  const updateRepository = (id: string, field: keyof SvnRepository, value: any) => {
    setRepositories(repositories.map(repo =>
      repo.id === id ? { ...repo, [field]: value } : repo
    ));
  };

  // Remove repository
  const removeRepository = (id: string) => {
    setRepositories(repositories.filter(repo => repo.id !== id));
  };

  // Generate project path from name
  const generateProjectPath = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  };

  // Parse YAML content
  const parseYaml = () => {
    try {
      const parsed = yaml.load(yamlContent) as any;
      setParseError(null);

      if (!parsed.svn_migrations || !Array.isArray(parsed.svn_migrations)) {
        setParseError('YAML 구조가 올바르지 않습니다. "svn_migrations" 배열이 필요합니다.');
        return;
      }

      const newRepos: SvnRepository[] = parsed.svn_migrations.map((item: any, index: number) => ({
        id: Date.now().toString() + '-' + index,
        svnUrl: item.svn_url || '',
        svnUsername: item.svn_username || '',
        svnPassword: item.svn_password || '',
        projectName: item.project_name || '',
        projectPath: item.project_path || generateProjectPath(item.project_name || ''),
        targetGroupId: item.target_group_id || selectedGroup?.id,
        targetGroupPath: item.target_group_path || selectedGroup?.full_path,
        layoutType: item.layout_type || 'standard',
        customLayout: item.custom_layout,
        status: 'pending',
      }));

      setRepositories(newRepos);
    } catch (error: any) {
      setParseError(`YAML 파싱 오류: ${error.message}`);
    }
  };

  // Validate repositories
  const validateRepositories = async () => {
    setIsLoading(true);
    const results: Record<string, any> = {};

    for (const repo of repositories) {
      try {
        // Update status to validating
        updateRepository(repo.id, 'status', 'validating');

        // Test SVN connection
        const connectionResult = await gitlabService.testSvnConnection({
          svnUrl: repo.svnUrl,
          svnUsername: repo.svnUsername,
          svnPassword: repo.svnPassword,
        });

        results[repo.id] = {
          success: true,
          data: connectionResult,
        };
        updateRepository(repo.id, 'status', 'valid');
      } catch (error: any) {
        results[repo.id] = {
          success: false,
          error: error.message || 'Connection failed',
        };
        updateRepository(repo.id, 'status', 'error');
        updateRepository(repo.id, 'error', error.message);
      }
    }

    setValidationResults(results);
    setIsLoading(false);
  };

  // Start bulk migration
  const startMigration = async () => {
    setIsLoading(true);
    
    try {
      const migrations = repositories
        .filter(repo => repo.status === 'valid')
        .map(repo => ({
          svnUrl: repo.svnUrl,
          svnUsername: repo.svnUsername,
          svnPassword: repo.svnPassword,
          gitlabProjectId: repo.targetGroupId,
          projectName: repo.projectName,
          projectPath: repo.projectPath,
          layout: repo.layoutType === 'standard'
            ? { trunk: 'trunk', branches: 'branches', tags: 'tags' }
            : repo.customLayout,
          authorsMapping: {}, // TODO: Add authors mapping UI
          options: {
            incremental: true,
            keepTempFiles: true, // 임시 디렉토리 유지 (재개 기능을 위해)
          },
        }));

      const result = await gitlabService.startBulkSvnMigration(migrations);
      
      alert(`${result.filter((r: any) => r.success).length}개의 마이그레이션이 시작되었습니다.`);
      onClose();
    } catch (error: any) {
      alert(`마이그레이션 시작 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle color="success" />;
      case 'error':
        return <Warning color="error" />;
      default:
        return null;
    }
  };

  const validRepoCount = repositories.filter(r => r.status === 'valid').length;
  const canStartMigration = validRepoCount > 0 && !isLoading;

  // YAML template
  const yamlTemplate = `svn_migrations:
  - svn_url: https://svn.example.com/repos/project1
    svn_username: user
    svn_password: pass
    project_name: Project One
    project_path: project-one
    layout_type: standard
    
  - svn_url: https://svn.example.com/repos/project2
    svn_username: user
    svn_password: pass
    project_name: Project Two
    project_path: project-two
    layout_type: custom
    custom_layout:
      trunk: src
      branches: branches
      tags: tags`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        대량 SVN 마이그레이션
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            여러 SVN 저장소를 동시에 GitLab으로 마이그레이션합니다.
            {selectedGroup && (
              <> 대상 그룹: <strong>{selectedGroup.full_path}</strong></>
            )}
          </Typography>
        </Box>

        {/* YAML Import Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            YAML 파일로 가져오기
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            placeholder={yamlTemplate}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          {parseError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {parseError}
            </Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={parseYaml}
            disabled={!yamlContent.trim()}
          >
            YAML 파싱
          </Button>
        </Paper>

        {/* Manual Entry Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            SVN 저장소 목록
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={addRepository}
          >
            저장소 추가
          </Button>
        </Box>

        {repositories.length === 0 ? (
          <Alert severity="info">
            추가된 저장소가 없습니다. "저장소 추가" 버튼을 클릭하거나 YAML 파일을 가져오세요.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>상태</TableCell>
                  <TableCell>SVN URL</TableCell>
                  <TableCell>사용자명</TableCell>
                  <TableCell>프로젝트명</TableCell>
                  <TableCell>프로젝트 경로</TableCell>
                  <TableCell>레이아웃</TableCell>
                  <TableCell width={50}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {repositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>
                      {repo.status === 'validating' ? (
                        <LinearProgress sx={{ width: 20 }} />
                      ) : (
                        getStatusIcon(repo.status)
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={repo.svnUrl}
                        onChange={(e) => updateRepository(repo.id, 'svnUrl', e.target.value)}
                        error={repo.status === 'error'}
                        helperText={repo.error}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={repo.svnUsername}
                        onChange={(e) => updateRepository(repo.id, 'svnUsername', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={repo.projectName}
                        onChange={(e) => {
                          updateRepository(repo.id, 'projectName', e.target.value);
                          updateRepository(repo.id, 'projectPath', generateProjectPath(e.target.value));
                        }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={repo.projectPath}
                        onChange={(e) => updateRepository(repo.id, 'projectPath', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={repo.layoutType}
                          onChange={(e) => updateRepository(repo.id, 'layoutType', e.target.value)}
                        >
                          <MenuItem value="standard">표준</MenuItem>
                          <MenuItem value="custom">커스텀</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeRepository(repo.id)}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {repositories.length > 0 && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={validateRepositories}
              disabled={isLoading || repositories.length === 0}
            >
              모든 연결 테스트
            </Button>
            {validRepoCount > 0 && (
              <Chip
                label={`${validRepoCount}개 준비됨`}
                color="success"
                size="small"
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          취소
        </Button>
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={startMigration}
          disabled={!canStartMigration}
        >
          {validRepoCount}개 마이그레이션 시작
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkSvnMigrationDialog;