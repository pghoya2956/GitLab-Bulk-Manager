import React, { useState, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
  Typography,
  Button,
  IconButton,
  Alert,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Upload,
  Download,
  ContentCopy,
  Check,
  Edit,
  Save,
  Cancel,
} from '@mui/icons-material';

interface AuthorsMappingEditorProps {
  authorsMapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
}

const AuthorsMappingEditor: React.FC<AuthorsMappingEditorProps> = ({
  authorsMapping,
  onChange,
}) => {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copiedUser, setCopiedUser] = useState<string | null>(null);

  const handleEdit = (svnUser: string) => {
    setEditingUser(svnUser);
    setEditValue(authorsMapping[svnUser]);
  };

  const handleSave = () => {
    if (editingUser) {
      onChange({
        ...authorsMapping,
        [editingUser]: editValue,
      });
      setEditingUser(null);
      setEditValue('');
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setEditValue('');
  };

  const handleBulkEdit = (pattern: string, replacement: string) => {
    const newMapping: Record<string, string> = {};
    Object.entries(authorsMapping).forEach(([svnUser, gitUser]) => {
      if (pattern === 'email') {
        // 이메일 도메인 일괄 변경
        newMapping[svnUser] = gitUser.replace(/@.*>/, `@${replacement}>`);
      } else if (pattern === 'format') {
        // 형식 일괄 변경
        newMapping[svnUser] = `${svnUser} <${svnUser}@${replacement}>`;
      }
    });
    onChange(newMapping);
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const newMapping: Record<string, string> = {};
          
          content.split('\n').forEach((line) => {
            const match = line.match(/^([^=]+)\s*=\s*(.+)$/);
            if (match) {
              const [, svnUser, gitUser] = match;
              newMapping[svnUser.trim()] = gitUser.trim();
            }
          });

          // 기존 매핑과 병합
          onChange({
            ...authorsMapping,
            ...newMapping,
          });
        } catch (error) {
          console.error('Failed to parse authors file:', error);
        }
      };
      reader.readAsText(file);
    }
  }, [authorsMapping, onChange]);

  const handleDownload = () => {
    const content = Object.entries(authorsMapping)
      .map(([svnUser, gitUser]) => `${svnUser} = ${gitUser}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'authors-mapping.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async (svnUser: string) => {
    const text = `${svnUser} = ${authorsMapping[svnUser]}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUser(svnUser);
      setTimeout(() => setCopiedUser(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const validateEmail = (gitUser: string): boolean => {
    const emailRegex = /^.+\s+<[^@]+@[^@]+\.[^@]+>$/;
    return emailRegex.test(gitUser);
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          SVN 사용자 → Git 사용자 매핑
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            accept=".txt"
            style={{ display: 'none' }}
            id="authors-file-upload"
            onChange={handleFileUpload}
          />
          <label htmlFor="authors-file-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={<Upload />}
              size="small"
            >
              파일 업로드
            </Button>
          </label>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleDownload}
            size="small"
          >
            다운로드
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Git 사용자는 "이름 &lt;이메일&gt;" 형식으로 입력해주세요.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>예시:</strong>
        </Typography>
        <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
          • John Doe &lt;john.doe@example.com&gt;<br />
          • 홍길동 &lt;gildong.hong@company.kr&gt;<br />
          • svnuser1 &lt;svnuser1@gitlab.local&gt;
        </Typography>
      </Alert>

      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            const domain = prompt('이메일 도메인을 입력하세요 (예: company.com)');
            if (domain) {
              handleBulkEdit('email', domain);
            }
          }}
        >
          이메일 도메인 일괄 변경
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            const domain = prompt('기본 이메일 도메인을 입력하세요 (예: company.com)');
            if (domain) {
              handleBulkEdit('format', domain);
            }
          }}
        >
          형식 일괄 설정
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>SVN 사용자</TableCell>
              <TableCell>Git 사용자</TableCell>
              <TableCell width={100}>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(authorsMapping).map(([svnUser, gitUser]) => (
              <TableRow key={svnUser}>
                <TableCell>
                  <Chip label={svnUser} size="small" />
                </TableCell>
                <TableCell>
                  {editingUser === svnUser ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="이름 <이메일@도메인.com>"
                      error={!validateEmail(editValue)}
                      helperText={!validateEmail(editValue) ? '올바른 형식이 아닙니다' : ''}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      color={validateEmail(gitUser) ? 'text.primary' : 'error'}
                    >
                      {gitUser}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {editingUser === svnUser ? (
                    <>
                      <IconButton size="small" onClick={handleSave} disabled={!validateEmail(editValue)}>
                        <Save />
                      </IconButton>
                      <IconButton size="small" onClick={handleCancel}>
                        <Cancel />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton size="small" onClick={() => handleEdit(svnUser)}>
                        <Edit />
                      </IconButton>
                      <Tooltip title={copiedUser === svnUser ? '복사됨!' : '클립보드에 복사'}>
                        <IconButton size="small" onClick={() => handleCopyToClipboard(svnUser)}>
                          {copiedUser === svnUser ? <Check /> : <ContentCopy />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          총 {Object.keys(authorsMapping).length}명의 사용자
          {Object.values(authorsMapping).filter(validateEmail).length !== Object.keys(authorsMapping).length && (
            <Typography component="span" color="error">
              {' '}(유효하지 않은 형식: {Object.values(authorsMapping).filter(v => !validateEmail(v)).length}개)
            </Typography>
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthorsMappingEditor;