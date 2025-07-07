import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import axios from 'axios';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import SpeedIcon from '@mui/icons-material/Speed';
import { format } from 'date-fns';

interface HealthData {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  components: {
    authentication?: {
      status: string;
      username?: string;
      isAdmin?: boolean;
      error?: string;
    };
    projects?: {
      status: string;
      totalCount?: number;
      error?: string;
    };
    groups?: {
      status: string;
      totalCount?: number;
      error?: string;
    };
    rateLimit?: {
      status: string;
      limit?: string;
      remaining?: string;
      reset?: string;
    };
  };
}

export const SystemHealth: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get<HealthData>('/api/gitlab/bulk/health-check');
      setHealthData(response.data);
      setLastCheck(new Date());
    } catch (err) {
      setError((err as any).response?.data?.message || '상태 확인 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // 30초마다 자동 갱신
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'unhealthy':
        return <ErrorIcon color="error" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      case 'degraded':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRateLimitPercentage = () => {
    if (!healthData?.components.rateLimit) {return 0;}
    const { limit, remaining } = healthData.components.rateLimit;
    if (!limit || !remaining) {return 0;}
    return (parseInt(remaining) / parseInt(limit)) * 100;
  };

  if (loading && !healthData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          GitLab 시스템 상태
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastCheck && (
            <Typography variant="body2" color="text.secondary">
              마지막 확인: {format(lastCheck, 'HH:mm:ss')}
            </Typography>
          )}
          <IconButton onClick={fetchHealthData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {healthData && (
        <>
          {/* 전체 상태 요약 */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getStatusIcon(healthData.status)}
              <Typography variant="h5">
                시스템 상태: 
                <Chip 
                  label={healthData.status.toUpperCase()} 
                  color={getStatusColor(healthData.status) as any}
                  sx={{ ml: 2 }}
                />
              </Typography>
            </Box>
          </Paper>

          <Grid container spacing={3}>
            {/* 인증 정보 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">인증</Typography>
                  </Box>
                  
                  {healthData.components.authentication && (
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          {getStatusIcon(healthData.components.authentication.status)}
                        </ListItemIcon>
                        <ListItemText 
                          primary="상태"
                          secondary={healthData.components.authentication.status}
                        />
                      </ListItem>
                      {healthData.components.authentication.username && (
                        <ListItem>
                          <ListItemText 
                            primary="사용자"
                            secondary={healthData.components.authentication.username}
                          />
                        </ListItem>
                      )}
                      {healthData.components.authentication.isAdmin !== undefined && (
                        <ListItem>
                          <ListItemText 
                            primary="권한"
                            secondary={healthData.components.authentication.isAdmin ? '관리자' : '일반 사용자'}
                          />
                        </ListItem>
                      )}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 리소스 통계 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>리소스</Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        <Typography variant="h4">
                          {healthData.components.groups?.totalCount || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          그룹
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <DescriptionIcon sx={{ fontSize: 48, color: 'secondary.main' }} />
                        <Typography variant="h4">
                          {healthData.components.projects?.totalCount || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          프로젝트
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* API Rate Limit */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SpeedIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">API Rate Limit</Typography>
                  </Box>
                  
                  {healthData.components.rateLimit && (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">
                            사용 가능: {healthData.components.rateLimit.remaining} / {healthData.components.rateLimit.limit}
                          </Typography>
                          <Typography variant="body2">
                            {getRateLimitPercentage().toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={getRateLimitPercentage()} 
                          sx={{ height: 10, borderRadius: 5 }}
                        />
                      </Box>
                      
                      {healthData.components.rateLimit.reset && (
                        <Typography variant="body2" color="text.secondary">
                          리셋 시간: {new Date(parseInt(healthData.components.rateLimit.reset) * 1000).toLocaleTimeString()}
                        </Typography>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 컴포넌트 상태 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>컴포넌트 상태</Typography>
                  
                  <Grid container spacing={2}>
                    {Object.entries(healthData.components).map(([key, component]) => (
                      <Grid item xs={12} sm={6} md={3} key={key}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2">
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Typography>
                            {getStatusIcon(component.status)}
                          </Box>
                          {'error' in component && component.error && (
                            <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                              {component.error}
                            </Typography>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};