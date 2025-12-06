import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  IconButton,
  Skeleton,
  LinearProgress,
  Chip,
  Avatar,
  Tooltip,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

import {
  ConnectionHealth,
  UserHealth,
  StatsHealth,
  RateLimitHealth,
  SessionHealth,
  fetchConnectionHealth,
  fetchUserHealth,
  fetchStatsHealth,
  fetchRateLimitHealth,
  fetchSessionHealth,
  invalidateHealthCache,
} from '../api/health';

// Skeleton Card Component
const SkeletonCard: React.FC<{ height?: number }> = ({ height = 120 }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Skeleton variant="text" width="60%" height={28} />
      <Skeleton variant="rectangular" height={height - 60} sx={{ mt: 2, borderRadius: 1 }} />
    </CardContent>
  </Card>
);

// Connection Status Card
const ConnectionCard: React.FC<{
  data: ConnectionHealth | null;
  loading: boolean;
  error: string | null;
}> = ({ data, loading, error }) => {
  if (loading) return <SkeletonCard />;

  const isHealthy = data?.status === 'healthy';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LinkIcon color="primary" />
          <Typography variant="h6">연결 상태</Typography>
          {isHealthy ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <ErrorIcon color="error" fontSize="small" />
          )}
        </Box>

        {error || data?.error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error || data?.error}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                상태
              </Typography>
              <Chip
                label={isHealthy ? '정상' : '오류'}
                color={isHealthy ? 'success' : 'error'}
                size="small"
              />
            </Box>
            {data?.latencyMs && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  응답 시간
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {data.latencyMs}ms
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// User Info Card
const UserCard: React.FC<{
  data: UserHealth | null;
  loading: boolean;
  error: string | null;
}> = ({ data, loading, error }) => {
  if (loading) return <SkeletonCard />;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6">사용자</Typography>
        </Box>

        {error || data?.error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error || data?.error}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={data?.avatarUrl} sx={{ width: 48, height: 48 }}>
              {data?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {data?.name || data?.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{data?.username}
              </Typography>
              {data?.isAdmin && (
                <Chip label="관리자" color="warning" size="small" sx={{ mt: 0.5 }} />
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Rate Limit Card
const RateLimitCard: React.FC<{
  data: RateLimitHealth | null;
  loading: boolean;
  error: string | null;
}> = ({ data, loading, error }) => {
  if (loading) return <SkeletonCard />;

  const usagePercent = data?.usagePercent ?? 0;
  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SpeedIcon color="primary" />
          <Typography variant="h6">API 사용량</Typography>
        </Box>

        {error || data?.error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error || data?.error}
          </Alert>
        ) : data?.status === 'unknown' ? (
          <Typography variant="body2" color="text.secondary">
            레이트 리밋 정보 없음
          </Typography>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {data?.used ?? 0} / {data?.limit ?? 0}
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {usagePercent}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={usagePercent}
              color={getProgressColor(usagePercent)}
              sx={{ height: 8, borderRadius: 4 }}
            />
            {data?.resetInSeconds !== null && data?.resetInSeconds !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                리셋까지 {data.resetInSeconds}초
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// GitLab Info Card
const GitLabInfoCard: React.FC<{
  connection: ConnectionHealth | null;
  session: SessionHealth | null;
  loading: boolean;
}> = ({ connection, session, loading }) => {
  if (loading) return <SkeletonCard height={160} />;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6">GitLab 정보</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              서버
            </Typography>
            <Tooltip title={session?.gitlabUrl || ''}>
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{
                  maxWidth: 250,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session?.gitlabUrl || '-'}
              </Typography>
            </Tooltip>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              버전
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {connection?.gitlabVersion
                ? `GitLab ${connection.gitlabVersion}`
                : '-'}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              세션 만료
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight="medium">
                {session?.expiresInMinutes !== null
                  ? `${session?.expiresInMinutes}분 후`
                  : '-'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Stats Card
const StatsCard: React.FC<{
  data: StatsHealth | null;
  loading: boolean;
  error: string | null;
}> = ({ data, loading, error }) => {
  if (loading) return <SkeletonCard height={140} />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          리소스 현황
        </Typography>

        {error || data?.error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error || data?.error}
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box
                sx={{
                  textAlign: 'center',
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                }}
              >
                <FolderIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {data?.groupCount?.toLocaleString() ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  접근 가능한 그룹
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box
                sx={{
                  textAlign: 'center',
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                }}
              >
                <DescriptionIcon sx={{ fontSize: 36, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {data?.projectCount?.toLocaleString() ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  접근 가능한 프로젝트
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export const SystemHealth: React.FC = () => {
  // Individual loading states
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rateLimitLoading, setRateLimitLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Data states
  const [connection, setConnection] = useState<ConnectionHealth | null>(null);
  const [user, setUser] = useState<UserHealth | null>(null);
  const [stats, setStats] = useState<StatsHealth | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitHealth | null>(null);
  const [session, setSession] = useState<SessionHealth | null>(null);

  // Error states
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (useCache = true) => {
    // 병렬로 모든 데이터 fetch
    setConnectionLoading(true);
    setUserLoading(true);
    setStatsLoading(true);
    setRateLimitLoading(true);
    setSessionLoading(true);

    // Connection (가장 중요, 먼저 표시)
    fetchConnectionHealth(useCache)
      .then((data) => {
        setConnection(data);
        setConnectionError(null);
      })
      .catch((err) => setConnectionError(err.message))
      .finally(() => setConnectionLoading(false));

    // Session (빠름, GitLab API 호출 없음)
    fetchSessionHealth(useCache)
      .then((data) => {
        setSession(data);
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));

    // User
    fetchUserHealth(useCache)
      .then((data) => {
        setUser(data);
        setUserError(null);
      })
      .catch((err) => setUserError(err.message))
      .finally(() => setUserLoading(false));

    // Rate Limit
    fetchRateLimitHealth(useCache)
      .then((data) => {
        setRateLimit(data);
        setRateLimitError(null);
      })
      .catch((err) => setRateLimitError(err.message))
      .finally(() => setRateLimitLoading(false));

    // Stats (가장 느림)
    fetchStatsHealth(useCache)
      .then((data) => {
        setStats(data);
        setStatsError(null);
      })
      .catch((err) => setStatsError(err.message))
      .finally(() => setStatsLoading(false));

    setLastCheck(new Date());
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    invalidateHealthCache();
    await fetchData(false);
    setIsRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData(true);

    // 30초마다 자동 갱신
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 전체 상태 계산
  const overallStatus = connection?.status === 'healthy' ? 'healthy' : 'unhealthy';

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {overallStatus === 'healthy' ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
            ) : (
              <ErrorIcon color="error" sx={{ fontSize: 32 }} />
            )}
            <Box>
              <Typography variant="h5" fontWeight="bold">
                시스템 헬스 대시보드
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {lastCheck
                  ? `마지막 확인: ${formatDistanceToNow(lastCheck, { addSuffix: true, locale: ko })}`
                  : '확인 중...'}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleRefresh}
            disabled={isRefreshing}
            color="primary"
            sx={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Top Cards - Connection, User, Rate Limit */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <ConnectionCard
            data={connection}
            loading={connectionLoading}
            error={connectionError}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <UserCard data={user} loading={userLoading} error={userError} />
        </Grid>
        <Grid item xs={12} md={4}>
          <RateLimitCard
            data={rateLimit}
            loading={rateLimitLoading}
            error={rateLimitError}
          />
        </Grid>
      </Grid>

      {/* Bottom Cards - GitLab Info, Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <GitLabInfoCard
            connection={connection}
            session={session}
            loading={connectionLoading || sessionLoading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatsCard data={stats} loading={statsLoading} error={statsError} />
        </Grid>
      </Grid>
    </Box>
  );
};
