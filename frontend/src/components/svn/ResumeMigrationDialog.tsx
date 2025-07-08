import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Alert,
  Box,
  Typography,
  Collapse,
  Paper,
  LinearProgress,
} from '@mui/material';
import { Warning, PlayArrow, Info } from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';

interface ResumeMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  migration: {
    id: string;
    svn_url: string;
    status: 'failed' | 'cancelled';
    last_synced_revision?: string;
    metadata?: {
      error?: string;
      project_name?: string;
    };
  };
  onResume: () => void;
}

const ResumeMigrationDialog: React.FC<ResumeMigrationDialogProps> = ({
  open,
  onClose,
  migration,
  onResume,
}) => {
  const [resumeFrom, setResumeFrom] = useState<'lastRevision' | 'beginning'>('lastRevision');
  const [svnUsername, setSvnUsername] = useState('');
  const [svnPassword, setSvnPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResumeFromLast, setCanResumeFromLast] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (open && migration.id) {
      checkResumability();
      loadRecentLogs();
    }
  }, [open, migration.id]);

  const checkResumability = async () => {
    try {
      // 임시 디렉토리 상태 확인 (백엔드에서 체크)
      const hasLastRevision = !!migration.last_synced_revision;
      setCanResumeFromLast(hasLastRevision);
      
      // last_synced_revision이 없으면 자동으로 'beginning' 선택
      if (!hasLastRevision) {
        setResumeFrom('beginning');
      }
    } catch (error) {
      console.error('Failed to check resumability:', error);
      setCanResumeFromLast(false);
      setResumeFrom('beginning');
    }
  };

  const loadRecentLogs = async () => {
    try {
      const migrationDetails = await gitlabService.getMigrationById(migration.id);
      if (migrationDetails.logs) {
        setLogs(migrationDetails.logs.slice(0, 10)); // 최근 10개 로그
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      const resumeData: any = { resumeFrom };
      
      // SVN 인증 정보가 입력된 경우에만 추가
      if (svnUsername || svnPassword) {
        resumeData.svnUsername = svnUsername;
        resumeData.svnPassword = svnPassword;
      }

      await gitlabService.resumeMigration(migration.id, resumeData);
      onResume();
      onClose();
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.needsAuth) {
        // SVN 인증 필요
        setNeedsAuth(true);
        // alert 제거하고 다이얼로그 유지
      } else {
        alert(`재개 실패: ${error.response?.data?.error || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PlayArrow color="primary" />
          마이그레이션 재개
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 마이그레이션 정보 */}
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              마이그레이션 정보
            </Typography>
            <Typography variant="body2" color="text.secondary">
              SVN URL: {migration.svn_url}
            </Typography>
            {migration.metadata?.project_name && (
              <Typography variant="body2" color="text.secondary">
                프로젝트: {migration.metadata.project_name}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              상태: {migration.status === 'failed' ? '실패' : '취소됨'}
            </Typography>
            {migration.last_synced_revision && (
              <Typography variant="body2" color="text.secondary">
                마지막 동기화 리비전: r{migration.last_synced_revision}
              </Typography>
            )}
          </Paper>

          {/* 오류 정보 */}
          {migration.metadata?.error && (
            <Alert severity="error" icon={<Warning />}>
              <Typography variant="subtitle2" gutterBottom>
                마지막 오류
              </Typography>
              <Typography variant="body2">
                {migration.metadata.error}
              </Typography>
            </Alert>
          )}

          {/* 최근 로그 */}
          {logs.length > 0 && (
            <Box>
              <Button
                size="small"
                onClick={() => setShowLogs(!showLogs)}
                startIcon={<Info />}
              >
                최근 로그 {showLogs ? '숨기기' : '보기'} ({logs.length}개)
              </Button>
              <Collapse in={showLogs}>
                <Paper sx={{ p: 1, mt: 1, maxHeight: 200, overflowY: 'auto', bgcolor: 'grey.900' }}>
                  {logs.map((log, index) => (
                    <Typography
                      key={index}
                      variant="caption"
                      component="div"
                      sx={{
                        fontFamily: 'monospace',
                        color: log.level === 'error' ? 'error.main' : 'grey.300',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      [{log.timestamp}] {log.level.toUpperCase()}: {log.message}
                    </Typography>
                  ))}
                </Paper>
              </Collapse>
            </Box>
          )}

          {/* 재개 옵션 */}
          <FormControl component="fieldset">
            <FormLabel component="legend">재개 옵션</FormLabel>
            <RadioGroup
              value={resumeFrom}
              onChange={(e) => setResumeFrom(e.target.value as any)}
            >
              <FormControlLabel
                value="lastRevision"
                control={<Radio />}
                label="이어서 진행 (마지막 동기화된 리비전부터)"
                disabled={!canResumeFromLast}
              />
              <FormControlLabel
                value="beginning"
                control={<Radio />}
                label="처음부터 다시 (기존 내용을 덮어씀)"
              />
            </RadioGroup>
          </FormControl>

          {!canResumeFromLast && (
            <Alert severity="info">
              임시 저장소가 없거나 손상되어 "이어서 진행" 옵션을 사용할 수 없습니다.
              처음부터 다시 시작해야 합니다.
            </Alert>
          )}

          {resumeFrom === 'beginning' && (
            <Alert severity="warning">
              <Typography variant="body2">
                <strong>주의:</strong> GitLab 프로젝트의 모든 커밋이 SVN 저장소의 내용으로 대체됩니다.
                이슈, 머지 리퀘스트 등의 메타데이터는 보존됩니다.
              </Typography>
            </Alert>
          )}

          {/* SVN 인증 정보 */}
          {needsAuth && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                SVN 인증 정보가 세션에 없습니다. 다시 입력해주세요.
              </Alert>
              <TextField
                fullWidth
                label="SVN 사용자명"
                value={svnUsername}
                onChange={(e) => setSvnUsername(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="SVN 비밀번호"
                type="password"
                value={svnPassword}
                onChange={(e) => setSvnPassword(e.target.value)}
                margin="normal"
              />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          onClick={handleResume}
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading ? null : <PlayArrow />}
        >
          {loading ? '재개 중...' : '재개'}
        </Button>
      </DialogActions>

      {loading && <LinearProgress />}
    </Dialog>
  );
};

export default ResumeMigrationDialog;