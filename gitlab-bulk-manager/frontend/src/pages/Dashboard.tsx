import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Card, CardContent, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { VirtualizedDataGrid } from '../components/VirtualizedDataGrid';
import { GridColDef } from '@mui/x-data-grid';
import { gitlabService } from '../services/gitlab';
import GroupIcon from '@mui/icons-material/AccountTree';
import ProjectIcon from '@mui/icons-material/Code';
import UserIcon from '@mui/icons-material/Person';

interface DashboardStats {
  groups: number;
  projects: number;
  users: number;
}

interface RecentActivity {
  id: number;
  type: string;
  action: string;
  targetTitle: string;
  createdAt: string;
  author: string;
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({ groups: 0, projects: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load stats in parallel
      const [groupsData, projectsData] = await Promise.all([
        gitlabService.getGroups({ per_page: 1 }),
        gitlabService.getProjects({ per_page: 1 }),
      ]);

      // For demo purposes, generate mock activities
      const mockActivities: RecentActivity[] = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        type: ['push', 'merge', 'issue', 'comment'][Math.floor(Math.random() * 4)],
        action: ['created', 'updated', 'closed', 'merged'][Math.floor(Math.random() * 4)],
        targetTitle: `Sample ${['Project', 'Issue', 'MR'][Math.floor(Math.random() * 3)]} #${i + 1}`,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        author: `User ${Math.floor(Math.random() * 10) + 1}`,
      }));

      setStats({
        groups: groupsData.length,
        projects: projectsData.length,
        users: 0, // Would need admin access to get user count
      });
      
      setActivities(mockActivities);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activityColumns: GridColDef[] = [
    { 
      field: 'type', 
      headerName: 'Type', 
      width: 100,
      renderCell: (params) => (
        <Box sx={{ 
          px: 1, 
          py: 0.5, 
          borderRadius: 1,
          bgcolor: params.value === 'push' ? 'info.100' : 
                  params.value === 'merge' ? 'success.100' :
                  params.value === 'issue' ? 'warning.100' : 'grey.200',
          color: params.value === 'push' ? 'info.dark' : 
                params.value === 'merge' ? 'success.dark' :
                params.value === 'issue' ? 'warning.dark' : 'text.primary',
        }}>
          {params.value}
        </Box>
      )
    },
    { field: 'action', headerName: 'Action', width: 120 },
    { field: 'targetTitle', headerName: 'Target', flex: 1, minWidth: 200 },
    { field: 'author', headerName: 'Author', width: 150 },
    { 
      field: 'createdAt', 
      headerName: 'Date', 
      width: 180,
      valueFormatter: (params) => new Date(params.value).toLocaleString(),
    },
  ];

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h3" component="div">
              {loading ? <Skeleton width={80} /> : value}
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 2,
            bgcolor: `${color}.100`,
            color: `${color}.dark`,
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GitLab Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Total Groups" 
            value={stats.groups} 
            icon={<GroupIcon sx={{ fontSize: 32 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Total Projects" 
            value={stats.projects} 
            icon={<ProjectIcon sx={{ fontSize: 32 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="Total Users" 
            value={stats.users} 
            icon={<UserIcon sx={{ fontSize: 32 }} />}
            color="info"
          />
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recent Activities
        </Typography>
        <VirtualizedDataGrid
          rows={activities}
          columns={activityColumns}
          height={400}
          pageSize={25}
          loading={loading}
          density="compact"
          showToolbar
        />
      </Paper>
    </Box>
  );
};