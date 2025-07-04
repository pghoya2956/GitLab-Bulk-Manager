import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PermissionGuard } from '../components/PermissionGuard';
import { Permission } from '../types/auth';
import { formatBytes, formatNumber } from '../utils/format';

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    in: number;
    out: number;
  };
}

interface GitLabStats {
  groups: number;
  projects: number;
  users: number;
  issues: number;
  mergeRequests: number;
  pipelines: number;
}

interface ActivityData {
  time: string;
  api_calls: number;
  errors: number;
  response_time: number;
}

export const Monitoring: React.FC = () => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState('1h');
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [loading, setLoading] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 45,
    memory: { used: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, percentage: 50 },
    disk: { used: 100 * 1024 * 1024 * 1024, total: 500 * 1024 * 1024 * 1024, percentage: 20 },
    network: { in: 1024 * 1024 * 10, out: 1024 * 1024 * 5 },
  });
  const [gitlabStats, setGitlabStats] = useState<GitLabStats>({
    groups: 25,
    projects: 150,
    users: 50,
    issues: 320,
    mergeRequests: 45,
    pipelines: 128,
  });
  const [activityData, setActivityData] = useState<ActivityData[]>([]);

  useEffect(() => {
    loadMonitoringData();
    generateMockActivityData();

    const interval = setInterval(() => {
      loadMonitoringData();
      generateMockActivityData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [timeRange, refreshInterval]);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      // In real implementation, fetch from monitoring API
      // Mock data with some randomization
      setSystemMetrics({
        cpu: Math.floor(Math.random() * 30 + 40),
        memory: {
          used: 8 * 1024 * 1024 * 1024 + Math.random() * 2 * 1024 * 1024 * 1024,
          total: 16 * 1024 * 1024 * 1024,
          percentage: Math.floor(Math.random() * 20 + 45),
        },
        disk: {
          used: 100 * 1024 * 1024 * 1024 + Math.random() * 20 * 1024 * 1024 * 1024,
          total: 500 * 1024 * 1024 * 1024,
          percentage: Math.floor(Math.random() * 5 + 20),
        },
        network: {
          in: Math.floor(Math.random() * 1024 * 1024 * 20),
          out: Math.floor(Math.random() * 1024 * 1024 * 10),
        },
      });
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockActivityData = () => {
    const data: ActivityData[] = [];
    const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 7;
    
    for (let i = 0; i < points; i++) {
      data.push({
        time: timeRange === '1h' ? `${i * 5}분` : timeRange === '24h' ? `${i}시` : `Day ${i + 1}`,
        api_calls: Math.floor(Math.random() * 1000 + 500),
        errors: Math.floor(Math.random() * 10),
        response_time: Math.floor(Math.random() * 100 + 50),
      });
    }
    
    setActivityData(data);
  };

  const getHealthStatus = () => {
    const cpuHealth = systemMetrics.cpu < 80;
    const memoryHealth = systemMetrics.memory.percentage < 80;
    const diskHealth = systemMetrics.disk.percentage < 90;
    
    if (cpuHealth && memoryHealth && diskHealth) {
      return { status: '정상', color: 'success' as const, icon: <CheckCircleIcon /> };
    } else {
      return { status: '주의', color: 'warning' as const, icon: <WarningIcon /> };
    }
  };

  const healthStatus = getHealthStatus();

  const COLORS = [theme.palette.primary.main, theme.palette.secondary.main, theme.palette.error.main, theme.palette.warning.main];

  const resourceUsageData = [
    { name: 'Groups', value: gitlabStats.groups },
    { name: 'Projects', value: gitlabStats.projects },
    { name: 'Issues', value: gitlabStats.issues },
    { name: 'MRs', value: gitlabStats.mergeRequests },
  ];

  return (
    <PermissionGuard permissions={[Permission.SYSTEM_MONITOR]}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">시스템 모니터링</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>기간</InputLabel>
              <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} label="기간">
                <MenuItem value="1h">1시간</MenuItem>
                <MenuItem value="24h">24시간</MenuItem>
                <MenuItem value="7d">7일</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={loadMonitoringData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* System Health Overview */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">시스템 상태</Typography>
            <Chip
              icon={healthStatus.icon}
              label={healthStatus.status}
              color={healthStatus.color}
            />
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SpeedIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">CPU 사용률</Typography>
                  </Box>
                  <Typography variant="h4">{systemMetrics.cpu}%</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemMetrics.cpu}
                    sx={{ mt: 1 }}
                    color={systemMetrics.cpu > 80 ? 'error' : 'primary'}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <MemoryIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">메모리</Typography>
                  </Box>
                  <Typography variant="h4">{systemMetrics.memory.percentage}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemMetrics.memory.percentage}
                    sx={{ mt: 1 }}
                    color={systemMetrics.memory.percentage > 80 ? 'error' : 'primary'}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <StorageIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">디스크</Typography>
                  </Box>
                  <Typography variant="h4">{systemMetrics.disk.percentage}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(systemMetrics.disk.used)} / {formatBytes(systemMetrics.disk.total)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemMetrics.disk.percentage}
                    sx={{ mt: 1 }}
                    color={systemMetrics.disk.percentage > 90 ? 'error' : 'primary'}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <NetworkIcon sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">네트워크</Typography>
                  </Box>
                  <Typography variant="body2">
                    IN: {formatBytes(systemMetrics.network.in)}/s
                  </Typography>
                  <Typography variant="body2">
                    OUT: {formatBytes(systemMetrics.network.out)}/s
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        {/* API Activity Chart */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                API 활동
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="api_calls"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.light}
                    name="API 호출"
                  />
                  <Area
                    type="monotone"
                    dataKey="errors"
                    stroke={theme.palette.error.main}
                    fill={theme.palette.error.light}
                    name="오류"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                리소스 분포
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={resourceUsageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {resourceUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Response Time Chart */}
        <Paper sx={{ p: 3, height: 300 }}>
          <Typography variant="h6" gutterBottom>
            응답 시간
          </Typography>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="response_time"
                stroke={theme.palette.secondary.main}
                name="응답 시간 (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Box>
    </PermissionGuard>
  );
};