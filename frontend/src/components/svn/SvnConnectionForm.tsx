import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Chip,
} from '@mui/material';
import { ExpandMore, CheckCircle } from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';

interface SvnConnectionFormProps {
  onSuccess: (data: any) => void;
  selectedGroup?: any;
  selectedProject?: any;
}

interface LayoutConfig {
  trunk: string;
  branches: string;
  tags: string;
}

const SvnConnectionForm: React.FC<SvnConnectionFormProps> = ({
  onSuccess,
  selectedGroup,
  selectedProject,
}) => {
  const [formData, setFormData] = useState({
    svnUrl: '',
    svnUsername: '',
    svnPassword: '',
    projectName: selectedProject?.name || '',
    projectPath: selectedProject?.path || '',
    layoutType: 'standard',
    customLayout: {
      trunk: 'trunk',
      branches: 'branches',
      tags: 'tags',
    } as LayoutConfig,
    options: {
      incremental: true,
      preserveEmptyDirs: false,
      includeBranches: [] as string[],
      excludeBranches: [] as string[],
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [svnInfo, setSvnInfo] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLayoutChange = (field: keyof LayoutConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      customLayout: {
        ...prev.customLayout,
        [field]: value,
      },
    }));
  };

  const handleOptionChange = (option: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [option]: value,
      },
    }));
  };

  const handleBranchPatternAdd = (type: 'include' | 'exclude', pattern: string) => {
    if (pattern.trim()) {
      const key = type === 'include' ? 'includeBranches' : 'excludeBranches';
      setFormData((prev) => ({
        ...prev,
        options: {
          ...prev.options,
          [key]: [...prev.options[key], pattern.trim()],
        },
      }));
    }
  };

  const handleBranchPatternRemove = (type: 'include' | 'exclude', index: number) => {
    const key = type === 'include' ? 'includeBranches' : 'excludeBranches';
    setFormData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: prev.options[key].filter((_, i) => i !== index),
      },
    }));
  };

  const testConnection = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await gitlabService.testSvnConnection({
        svnUrl: formData.svnUrl,
        svnUsername: formData.svnUsername,
        svnPassword: formData.svnPassword,
      });

      setSvnInfo(result);
      setSuccess(true);

      // 프로젝트 이름 자동 설정
      if (!formData.projectName && result.repository_root) {
        const repoName = result.repository_root.split('/').pop() || 'svn-migration';
        setFormData((prev) => ({
          ...prev,
          projectName: repoName,
          projectPath: repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        }));
      }
    } catch (err: any) {
      setError(err.message || 'SVN 연결 테스트 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!success) {
      setError('먼저 SVN 연결을 테스트해주세요.');
      return;
    }

    const layout = formData.layoutType === 'standard'
      ? { trunk: 'trunk', branches: 'branches', tags: 'tags' }
      : formData.customLayout;

    onSuccess({
      ...formData,
      layout,
      svnInfo,
    });
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedGroup && (
          <>선택된 그룹: <strong>{selectedGroup.full_path}</strong></>
        )}
        {selectedProject && (
          <>선택된 프로젝트: <strong>{selectedProject.path_with_namespace}</strong></>
        )}
      </Typography>

      <TextField
        fullWidth
        label="SVN Repository URL"
        name="svnUrl"
        value={formData.svnUrl}
        onChange={handleInputChange}
        placeholder="https://svn.example.com/repos/myproject"
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="SVN 사용자명"
        name="svnUsername"
        value={formData.svnUsername}
        onChange={handleInputChange}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="SVN 비밀번호"
        name="svnPassword"
        type="password"
        value={formData.svnPassword}
        onChange={handleInputChange}
        margin="normal"
        required
      />

      <Box sx={{ mt: 2, mb: 3 }}>
        <Button
          variant="outlined"
          onClick={testConnection}
          disabled={isLoading || !formData.svnUrl || !formData.svnUsername || !formData.svnPassword}
          startIcon={isLoading ? <CircularProgress size={20} /> : success ? <CheckCircle /> : null}
        >
          {isLoading ? '연결 중...' : success ? '연결 성공' : 'SVN 연결 테스트'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {svnInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Repository Root:</strong> {svnInfo.repository_root}<br />
            <strong>Repository UUID:</strong> {svnInfo.repository_uuid}<br />
            <strong>Revision:</strong> {svnInfo.revision}
          </Typography>
        </Alert>
      )}

      {success && (
        <>
          <TextField
            fullWidth
            label="GitLab 프로젝트 이름"
            name="projectName"
            value={formData.projectName}
            onChange={handleInputChange}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="GitLab 프로젝트 경로"
            name="projectPath"
            value={formData.projectPath}
            onChange={handleInputChange}
            margin="normal"
            required
            helperText="영문 소문자, 숫자, 하이픈만 사용 가능"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>레이아웃 타입</InputLabel>
            <Select
              value={formData.layoutType}
              onChange={(e) => setFormData({ ...formData, layoutType: e.target.value })}
              label="레이아웃 타입"
            >
              <MenuItem value="standard">표준 (trunk/branches/tags)</MenuItem>
              <MenuItem value="custom">커스텀</MenuItem>
            </Select>
          </FormControl>

          {formData.layoutType === 'custom' && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Trunk 경로"
                value={formData.customLayout.trunk}
                onChange={(e) => handleLayoutChange('trunk', e.target.value)}
                margin="dense"
              />
              <TextField
                fullWidth
                label="Branches 경로"
                value={formData.customLayout.branches}
                onChange={(e) => handleLayoutChange('branches', e.target.value)}
                margin="dense"
              />
              <TextField
                fullWidth
                label="Tags 경로"
                value={formData.customLayout.tags}
                onChange={(e) => handleLayoutChange('tags', e.target.value)}
                margin="dense"
              />
            </Box>
          )}

          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>고급 옵션</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.options.incremental}
                    onChange={(e) => handleOptionChange('incremental', e.target.checked)}
                  />
                }
                label="증분 마이그레이션 지원"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.options.preserveEmptyDirs}
                    onChange={(e) => handleOptionChange('preserveEmptyDirs', e.target.checked)}
                  />
                }
                label="빈 디렉토리 보존"
              />

              <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
                포함할 브랜치 패턴:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {formData.options.includeBranches.map((pattern, index) => (
                  <Chip
                    key={index}
                    label={pattern}
                    onDelete={() => handleBranchPatternRemove('include', index)}
                    size="small"
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="release/*"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBranchPatternAdd('include', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </Box>

              <Typography variant="body2" sx={{ mb: 1 }}>
                제외할 브랜치 패턴:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {formData.options.excludeBranches.map((pattern, index) => (
                  <Chip
                    key={index}
                    label={pattern}
                    onDelete={() => handleBranchPatternRemove('exclude', index)}
                    size="small"
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="experimental/*"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBranchPatternAdd('exclude', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.projectName || !formData.projectPath}
            >
              다음 단계
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SvnConnectionForm;