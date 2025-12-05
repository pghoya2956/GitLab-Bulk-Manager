/**
 * BulkProgressBar - 대량 작업 진행 상태 표시 컴포넌트
 * 진행률, 시간, 상태 메시지 표시
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  LinearProgress,
  CircularProgress,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Pause,
  PlayArrow,
  Stop,
  ExpandMore,
  ExpandLess,
  Timer,
  Speed,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';

export interface BulkProgressBarProps {
  // 필수 props
  progress: number; // 0-100
  total: number;
  completed: number;
  
  // 선택적 props
  loading?: boolean;
  variant?: 'linear' | 'circular' | 'both';
  showStats?: boolean;
  showTime?: boolean;
  showSpeed?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  message?: string;
  startTime?: Date;
  estimatedTime?: number; // seconds
  
  // 액션
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  
  // 스타일
  height?: number;
  compact?: boolean;
  animated?: boolean;
}

export const BulkProgressBar: React.FC<BulkProgressBarProps> = ({
  progress,
  total,
  completed,
  loading = false,
  variant = 'linear',
  showStats = true,
  showTime = true,
  showSpeed = false,
  color = 'primary',
  status = 'running',
  message,
  startTime,
  estimatedTime,
  onPause,
  onResume,
  onStop,
  height = 4,
  compact = false,
  animated = true,
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 경과 시간 계산
  useEffect(() => {
    if (!startTime || status !== 'running') return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, status]);

  // 속도 계산
  const speed = useMemo(() => {
    if (elapsedTime === 0 || completed === 0) return 0;
    return completed / elapsedTime; // items per second
  }, [completed, elapsedTime]);

  // 예상 남은 시간
  const remainingTime = useMemo(() => {
    if (speed === 0) return estimatedTime || 0;
    const remaining = total - completed;
    return Math.ceil(remaining / speed);
  }, [speed, total, completed, estimatedTime]);

  // 시간 포맷
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    }
    if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    }
    return `${secs}초`;
  };

  // 상태 아이콘
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" fontSize="small" />;
      case 'error':
        return <Error color="error" fontSize="small" />;
      case 'paused':
        return <Warning color="warning" fontSize="small" />;
      default:
        return null;
    }
  };

  // 상태 색상
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return color;
    }
  };

  // Linear Progress Bar
  const renderLinearProgress = () => (
    <Box sx={{ width: '100%' }}>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={progress}
        color={getStatusColor()}
        sx={{
          height,
          borderRadius: height / 2,
          '& .MuiLinearProgress-bar': {
            borderRadius: height / 2,
            ...(animated && {
              transition: 'transform 0.4s ease',
            }),
          },
        }}
      />
    </Box>
  );

  // Circular Progress
  const renderCircularProgress = () => (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={progress}
        color={getStatusColor()}
        size={60}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" component="div" color="text.secondary">
          {`${Math.round(progress)}%`}
        </Typography>
      </Box>
    </Box>
  );

  // 통계 정보
  const renderStats = () => (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={6} sm={3}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            완료
          </Typography>
          <Typography variant="body2">
            {completed} / {total}
          </Typography>
        </Box>
      </Grid>
      
      {showTime && (
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              경과 시간
            </Typography>
            <Typography variant="body2">{formatTime(elapsedTime)}</Typography>
          </Box>
        </Grid>
      )}
      
      {showTime && remainingTime > 0 && (
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              남은 시간
            </Typography>
            <Typography variant="body2">{formatTime(remainingTime)}</Typography>
          </Box>
        </Grid>
      )}
      
      {showSpeed && speed > 0 && (
        <Grid item xs={6} sm={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              처리 속도
            </Typography>
            <Typography variant="body2">{speed.toFixed(1)}/초</Typography>
          </Box>
        </Grid>
      )}
    </Grid>
  );

  // Compact 모드
  if (compact) {
    return (
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {variant === 'circular' && renderCircularProgress()}
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {getStatusIcon()}
              <Typography variant="body2">
                {message || `처리 중... ${completed}/${total}`}
              </Typography>
              <Chip
                label={`${Math.round(progress)}%`}
                size="small"
                color={getStatusColor()}
              />
            </Box>
            {variant !== 'circular' && renderLinearProgress()}
          </Box>
          
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        
        <Collapse in={expanded}>
          {showStats && renderStats()}
        </Collapse>
      </Paper>
    );
  }

  // 일반 모드
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {variant === 'circular' || variant === 'both' ? (
          renderCircularProgress()
        ) : null}
        
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {getStatusIcon()}
            <Typography variant="body1">
              {message || `작업 진행 중...`}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              진행률:
            </Typography>
            <Typography variant="body2">
              {completed} / {total} ({Math.round(progress)}%)
            </Typography>
            
            {showTime && elapsedTime > 0 && (
              <>
                <Timer fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {formatTime(elapsedTime)}
                </Typography>
              </>
            )}
            
            {showSpeed && speed > 0 && (
              <>
                <Speed fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {speed.toFixed(1)}/초
                </Typography>
              </>
            )}
          </Box>
        </Box>
        
        {/* 액션 버튼 */}
        {(onPause || onResume || onStop) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {status === 'running' && onPause && (
              <Tooltip title="일시정지">
                <IconButton size="small" onClick={onPause}>
                  <Pause />
                </IconButton>
              </Tooltip>
            )}
            {status === 'paused' && onResume && (
              <Tooltip title="재개">
                <IconButton size="small" onClick={onResume}>
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            )}
            {onStop && (
              <Tooltip title="중지">
                <IconButton size="small" onClick={onStop} color="error">
                  <Stop />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
      
      {(variant === 'linear' || variant === 'both') && renderLinearProgress()}
      
      {showStats && renderStats()}
    </Paper>
  );
};

/**
 * 간단한 진행률 표시
 */
export const SimpleProgress: React.FC<{
  value: number;
  label?: string;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}> = ({ value, label, color = 'primary' }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={value}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 35 }}>
        {label || `${Math.round(value)}%`}
      </Typography>
    </Box>
  );
};

export default BulkProgressBar;