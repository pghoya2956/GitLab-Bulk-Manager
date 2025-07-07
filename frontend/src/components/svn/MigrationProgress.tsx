import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  Sync,
  ExpandMore,
  ExpandLess,
  Terminal,
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface MigrationProgressProps {
  migrationId: string;
  onComplete?: () => void;
}

interface MigrationLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

const MigrationProgress: React.FC<MigrationProgressProps> = ({
  migrationId,
  onComplete,
}) => {
  const [status, setStatus] = useState<'running' | 'completed' | 'failed' | 'syncing'>('running');
  const [progress, setProgress] = useState({
    currentRevision: 0,
    totalCommits: 0,
    message: '마이그레이션 준비 중...',
  });
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [startTime] = useState(new Date());

  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    // 마이그레이션 진행 상황 이벤트
    const handleProgress = (data: any) => {
      if (data.id === migrationId) {
        setProgress({
          currentRevision: data.currentRevision || 0,
          totalCommits: data.totalCommits || 0,
          message: data.message || '',
        });
      }
    };

    // 마이그레이션 로그 이벤트
    const handleLog = (data: any) => {
      if (data.id === migrationId) {
        setLogs((prev) => [...prev, {
          timestamp: new Date(data.timestamp || Date.now()),
          level: data.level || 'info',
          message: data.message || '',
        }]);
      }
    };

    // 마이그레이션 완료 이벤트
    const handleCompleted = (data: any) => {
      if (data.id === migrationId) {
        setStatus('completed');
        setProgress((prev) => ({
          ...prev,
          message: '마이그레이션 완료!',
        }));
        if (onComplete) {
          setTimeout(onComplete, 2000);
        }
      }
    };

    // 마이그레이션 실패 이벤트
    const handleFailed = (data: any) => {
      if (data.id === migrationId) {
        setStatus('failed');
        setProgress((prev) => ({
          ...prev,
          message: `실패: ${data.error || '알 수 없는 오류'}`,
        }));
      }
    };

    // 동기화 시작 이벤트
    const handleSyncing = (data: any) => {
      if (data.id === migrationId) {
        setStatus('syncing');
        setProgress((prev) => ({
          ...prev,
          message: '증분 동기화 중...',
        }));
      }
    };

    // 동기화 완료 이벤트
    const handleSynced = (data: any) => {
      if (data.id === migrationId) {
        setStatus('completed');
        setProgress((prev) => ({
          ...prev,
          message: `동기화 완료! 새로운 리비전 ${data.newRevisions}개 추가됨`,
        }));
      }
    };

    socket.on('migration:progress', handleProgress);
    socket.on('migration:log', handleLog);
    socket.on('migration:completed', handleCompleted);
    socket.on('migration:failed', handleFailed);
    socket.on('migration:syncing', handleSyncing);
    socket.on('migration:synced', handleSynced);

    return () => {
      socket.off('migration:progress', handleProgress);
      socket.off('migration:log', handleLog);
      socket.off('migration:completed', handleCompleted);
      socket.off('migration:failed', handleFailed);
      socket.off('migration:syncing', handleSyncing);
      socket.off('migration:synced', handleSynced);
    };
  }, [socket, migrationId, onComplete]);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'syncing':
        return <Sync color="info" />;
      default:
        return <HourglassEmpty color="primary" />;
    }
  };


  const getProgressValue = () => {
    if (progress.totalCommits === 0) return 0;
    return Math.min(100, (progress.totalCommits / progress.currentRevision) * 100);
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getStatusIcon()}
            <Typography variant="h6" sx={{ ml: 1 }}>
              {status === 'running' ? '마이그레이션 진행 중' :
               status === 'completed' ? '마이그레이션 완료' :
               status === 'failed' ? '마이그레이션 실패' :
               '증분 동기화 중'}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              <Chip
                label={formatDistanceToNow(startTime, { locale: ko, addSuffix: true })}
                size="small"
              />
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            {progress.message}
          </Typography>

          {status === 'running' && (
            <>
              <LinearProgress
                variant="determinate"
                value={getProgressValue()}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption">
                  리비전: {progress.currentRevision}
                </Typography>
                <Typography variant="caption">
                  커밋 수: {progress.totalCommits}
                </Typography>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Terminal sx={{ mr: 1 }} />
          <Typography variant="subtitle1">
            마이그레이션 로그
          </Typography>
          <IconButton
            size="small"
            sx={{ ml: 'auto' }}
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={showLogs}>
          <Box
            sx={{
              maxHeight: 300,
              overflow: 'auto',
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <Box key={index} sx={{ mb: 0.5 }}>
                  <span style={{ color: log.level === 'error' ? '#ff5252' : log.level === 'warning' ? '#ffc107' : '#4caf50' }}>
                    [{log.level.toUpperCase()}]
                  </span>
                  {' '}
                  <span style={{ color: '#90caf9' }}>
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  {' '}
                  {log.message}
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="grey.500">
                로그가 없습니다.
              </Typography>
            )}
          </Box>
        </Collapse>
      </Paper>

      {status === 'failed' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          마이그레이션이 실패했습니다. 로그를 확인하고 다시 시도해주세요.
        </Alert>
      )}

      {status === 'completed' && (
        <Alert severity="success" sx={{ mt: 2 }}>
          마이그레이션이 성공적으로 완료되었습니다!
        </Alert>
      )}
    </Box>
  );
};

export default MigrationProgress;