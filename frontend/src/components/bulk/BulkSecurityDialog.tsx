/**
 * BulkSecurityDialog - 보안 스캔 실행 다이얼로그
 * 선택된 프로젝트들에 대해 Trivy + Semgrep 스캔 실행
 */

import React, { useState, useEffect } from 'react';
import {
  Alert,
  Typography,
  Box,
  CircularProgress,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  Security,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  Warning,
} from '@mui/icons-material';

// Base Components
import { BaseBulkDialog } from '../common/BaseBulkDialog';
import { BulkItemList } from '../common/BulkItemList';
import { DialogActionButtons } from '../common/BulkActionButtons';

// API
import {
  getScanningStatus,
  startSecurityScan,
  ScanToolStatus,
  ScanResult,
} from '../../api/security';

// Utils
import { ItemFilter } from '../../utils/itemFilter';

interface BulkSecurityDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: (result?: { results: ScanResult[] }) => void;
}

type DialogState = 'initial' | 'scanning' | 'completed';

export const BulkSecurityDialog: React.FC<BulkSecurityDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [state, setState] = useState<DialogState>('initial');
  const [toolStatus, setToolStatus] = useState<ScanToolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [currentProject, setCurrentProject] = useState<string>('');

  // 프로젝트만 필터링 (그룹은 스캔 불가)
  const { groups, projects } = ItemFilter.separateByType(selectedItems);

  // 스캔 도구 상태 확인
  useEffect(() => {
    if (open) {
      checkToolStatus();
    }
  }, [open]);

  const checkToolStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getScanningStatus();
      setToolStatus(status);
    } catch (err: any) {
      setError(err.response?.data?.error || '스캔 도구 상태 확인 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (projects.length === 0) return;

    setState('scanning');
    setError(null);
    setResults([]);

    try {
      // 프로젝트 정보 준비
      const projectsToScan = projects.map((p) => {
        const numericId = p.id.includes('-')
          ? parseInt(p.id.split('-').pop() || '0')
          : parseInt(p.id);
        return {
          id: numericId,
          name: p.name,
          path_with_namespace: p.full_path,
        };
      });

      // 스캔 시작
      setCurrentProject(projectsToScan[0]?.name || '');

      const response = await startSecurityScan(projectsToScan);

      setResults(response.results);
      setState('completed');

      if (onSuccess) {
        onSuccess({ results: response.results });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '보안 스캔 실행 실패');
      setState('initial');
    }
  };

  const handleClose = () => {
    if (state === 'scanning') return;
    setState('initial');
    setResults([]);
    setError(null);
    onClose();
  };

  const handleViewResults = () => {
    // 결과 페이지로 이동
    window.location.href = '/security';
  };

  // 로딩 중
  if (loading) {
    return (
      <BaseBulkDialog
        open={open}
        onClose={handleClose}
        title="보안 스캔"
        subtitle="스캔 도구 상태 확인 중..."
        icon={<Security color="primary" />}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </BaseBulkDialog>
    );
  }

  // 스캔 진행 중
  if (state === 'scanning') {
    return (
      <BaseBulkDialog
        open={open}
        onClose={handleClose}
        title="보안 스캔 진행 중"
        subtitle={`${projects.length}개 프로젝트를 스캔하고 있습니다`}
        icon={<Security color="primary" />}
        maxWidth="sm"
      >
        <Box sx={{ py: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              스캔은 프로젝트 크기에 따라 수 분이 걸릴 수 있습니다.
              창을 닫지 마세요.
            </Typography>
          </Alert>

          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              스캔 중...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentProject && `현재: ${currentProject}`}
            </Typography>
          </Box>

          <LinearProgress sx={{ mt: 2 }} />
        </Box>
      </BaseBulkDialog>
    );
  }

  // 스캔 완료
  if (state === 'completed') {
    const successful = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');

    return (
      <BaseBulkDialog
        open={open}
        onClose={handleClose}
        title="보안 스캔 완료"
        subtitle={`${successful.length}/${results.length}개 프로젝트 스캔 완료`}
        icon={<CheckCircle color="success" />}
        maxWidth="md"
        actions={
          <DialogActionButtons
            onCancel={handleClose}
            onConfirm={handleViewResults}
            cancelLabel="닫기"
            confirmLabel="결과 보기"
            confirmIcon={<Security />}
          />
        }
      >
        <Box sx={{ py: 1 }}>
          {/* 요약 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Chip
              icon={<CheckCircle />}
              label={`성공: ${successful.length}`}
              color="success"
              variant="outlined"
            />
            {failed.length > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`실패: ${failed.length}`}
                color="error"
                variant="outlined"
              />
            )}
          </Box>

          {/* 결과 목록 */}
          <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense>
              {results.map((result, idx) => (
                <ListItem key={idx} divider={idx < results.length - 1}>
                  <ListItemIcon>
                    {result.status === 'completed' ? (
                      result.summary &&
                      (result.summary.critical > 0 || result.summary.high > 0) ? (
                        <Warning color="error" />
                      ) : (
                        <CheckCircle color="success" />
                      )
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={result.projectName}
                    secondary={
                      result.status === 'completed' ? (
                        <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                          {result.summary && (
                            <>
                              {result.summary.critical > 0 && (
                                <Chip size="small" label={`Critical: ${result.summary.critical}`} color="error" />
                              )}
                              {result.summary.high > 0 && (
                                <Chip size="small" label={`High: ${result.summary.high}`} color="error" variant="outlined" />
                              )}
                              {result.summary.medium > 0 && (
                                <Chip size="small" label={`Medium: ${result.summary.medium}`} color="warning" />
                              )}
                              {result.summary.low > 0 && (
                                <Chip size="small" label={`Low: ${result.summary.low}`} color="info" />
                              )}
                              {result.totalVulnerabilities === 0 && (
                                <Typography variant="caption" color="success.main">
                                  취약점 없음
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="error">
                          {result.error || '스캔 실패'}
                        </Typography>
                      )
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      </BaseBulkDialog>
    );
  }

  // 초기 상태
  return (
    <BaseBulkDialog
      open={open}
      onClose={handleClose}
      title="보안 스캔"
      subtitle={
        projects.length > 0
          ? `${projects.length}개 프로젝트의 보안 취약점을 검사합니다`
          : '스캔할 프로젝트가 없습니다'
      }
      icon={<Security color="primary" />}
      maxWidth="sm"
      actions={
        projects.length > 0 &&
        toolStatus?.ready && (
          <DialogActionButtons
            onCancel={handleClose}
            onConfirm={handleScan}
            confirmLabel="스캔 시작"
            confirmIcon={<Security />}
            disabled={projects.length === 0 || !toolStatus?.ready}
          />
        )
      }
    >
      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 도구 상태 */}
      {toolStatus && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            스캔 도구 상태
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              icon={toolStatus.trivy.available ? <CheckCircle /> : <HourglassEmpty />}
              label={`Trivy ${toolStatus.trivy.version || '미설치'}`}
              color={toolStatus.trivy.available ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              size="small"
              icon={toolStatus.semgrep.available ? <CheckCircle /> : <HourglassEmpty />}
              label={`Semgrep ${toolStatus.semgrep.version || '미설치'}`}
              color={toolStatus.semgrep.available ? 'success' : 'default'}
              variant="outlined"
            />
          </Box>
          {toolStatus.runningScans > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              현재 진행 중인 스캔: {toolStatus.runningScans}/{toolStatus.maxConcurrentScans}
            </Typography>
          )}
        </Paper>
      )}

      {/* 도구 미설치 경고 */}
      {toolStatus && !toolStatus.ready && (
        <Alert severity="error" sx={{ mb: 2 }}>
          보안 스캔 도구가 설치되어 있지 않습니다.
          서버에 Trivy 또는 Semgrep을 설치해주세요.
        </Alert>
      )}

      {/* 그룹 경고 */}
      {groups.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>주의:</strong> 그룹은 스캔할 수 없습니다.
            선택된 {groups.length}개 그룹은 건너뛰고 프로젝트만 스캔됩니다.
          </Typography>
        </Alert>
      )}

      {/* 프로젝트 없음 */}
      {projects.length === 0 && (
        <Alert severity="error">
          스캔할 수 있는 프로젝트가 선택되지 않았습니다.
          프로젝트를 선택한 후 다시 시도해주세요.
        </Alert>
      )}

      {/* 스캔할 프로젝트 목록 */}
      {projects.length > 0 && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              선택된 프로젝트의 소스코드를 다운로드하여 의존성 취약점, 코드 보안 이슈,
              시크릿 노출 등을 검사합니다. 프로젝트 크기에 따라 수 분이 소요될 수 있습니다.
            </Typography>
          </Alert>

          <BulkItemList
            items={projects}
            title={`스캔할 프로젝트 (${projects.length}개)`}
            maxHeight={200}
            showStats={false}
          />
        </>
      )}
    </BaseBulkDialog>
  );
};
