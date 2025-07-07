import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Snackbar
} from '@mui/material';
import axios from 'axios';
// import { useSelector } from 'react-redux';
// import { RootState } from '../../store';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface YamlEditorProps {
  type: 'subgroups' | 'projects';
  onExecute?: (data: any) => void;
  initialData?: string;
  initialYaml?: string;  // Support both prop names
  parentId?: number;
  disabled?: boolean;
}

const YAML_TEMPLATES = {
  subgroups: `# GitLab 서브그룹 생성 설정
parent_id: 123  # 부모 그룹 ID (필수)

defaults:
  visibility: private
  request_access_enabled: true
  project_creation_level: developer
  subgroup_creation_level: maintainer

subgroups:
  - name: "개발팀"
    path: "dev-team"
    description: "개발 조직"
    visibility: internal
    
    subgroups:
      - name: "프론트엔드"
        path: "frontend"
        description: "웹/모바일 UI 개발"
        
      - name: "백엔드"
        path: "backend"
        description: "API 및 서버 개발"

options:
  continue_on_error: true
  skip_existing: true
  api_delay: 200`,

  projects: `# GitLab 프로젝트 생성 설정
defaults:
  visibility: private
  default_branch: main
  initialize_with_readme: true

projects:
  - group_id: 110  # 그룹 ID (필수)
    projects:
      - name: "web-app"
        description: "웹 애플리케이션"
        topics: ["frontend", "react"]
        settings:
          pages_enabled: true
          
      - name: "api-server"
        description: "REST API 서버"
        topics: ["backend", "nodejs"]

branch_protection:
  default:
    branch: main
    push_access_level: developer
    merge_access_level: maintainer

ci_variables:
  global:
    - key: "ENVIRONMENT"
      value: "production"
      protected: true`
};

export const YamlEditor: React.FC<YamlEditorProps> = ({ type, onExecute, initialData, initialYaml, parentId, disabled }) => {
  const [yamlContent, setYamlContent] = useState(() => {
    if (initialYaml) {return initialYaml;}
    if (initialData) {return initialData;}
    const template = YAML_TEMPLATES[type];
    if (parentId && type === 'subgroups') {
      return template.replace('parent_id: 123', `parent_id: ${parentId}`);
    }
    return template;
  });
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // const token = useSelector((state: RootState) => state.auth.token);

  // YAML 파싱
  const parseYaml = async () => {
    try {
      setError(null);
      const response = await axios.post('/api/gitlab/bulk/parse-yaml', {
        content: yamlContent
      });
      
      if (response.data.success) {
        setParsedData(response.data.data);
        setTabValue(1); // 미리보기 탭으로 전환
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'YAML 파싱 실패');
    }
  };

  // 실행
  const handleExecute = async () => {
    if (!parsedData) {
      setError('먼저 YAML을 검증해주세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'subgroups' ? '/api/gitlab/bulk/subgroups' : '/api/gitlab/bulk/projects';
      const response = await axios.post(endpoint, parsedData);
      
      if (response.data.success) {
        setSuccessMessage(`성공: ${response.data.summary.created}개 생성, ${response.data.summary.skipped}개 건너뜀, ${response.data.summary.failed}개 실패`);
        if (onExecute) {
          onExecute(response.data);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '실행 실패');
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setYamlContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  // 파일 다운로드
  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-config.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 클립보드 복사
  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setSuccessMessage('클립보드에 복사되었습니다');
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            {type === 'subgroups' ? '서브그룹 일괄 생성' : '프로젝트 일괄 생성'}
          </Typography>
          <Box>
            <Button
              size="small"
              startIcon={<UploadIcon />}
              component="label"
              sx={{ mr: 1 }}
            >
              업로드
              <input
                type="file"
                accept=".yaml,.yml"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ mr: 1 }}
            >
              다운로드
            </Button>
            <Button
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
            >
              복사
            </Button>
          </Box>
        </Box>

        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="YAML 편집" />
          <Tab label="미리보기" disabled={!parsedData} />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <TextField
              multiline
              fullWidth
              rows={20}
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              variant="outlined"
              sx={{ 
                fontFamily: 'monospace',
                '& .MuiInputBase-input': {
                  fontSize: '14px'
                }
              }}
            />
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={parseYaml}
              >
                YAML 검증
              </Button>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                onClick={handleExecute}
                disabled={loading || !parsedData || disabled}
              >
                실행
              </Button>
            </Box>
          </Box>
        )}

        {tabValue === 1 && parsedData && (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <pre style={{ margin: 0, overflow: 'auto' }}>
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            </Paper>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                onClick={handleExecute}
                disabled={loading || disabled}
              >
                실행
              </Button>
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Box>
  );
};