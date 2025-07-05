import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Button, 
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gitlabService } from '../services/gitlab';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import axios from 'axios';
import { PermissionTree } from '../components/PermissionTree';
import GroupIcon from '@mui/icons-material/AccountTree';
import ProjectIcon from '@mui/icons-material/Code';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';


export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);

  const quickActions = [
    {
      title: 'Groups & Projects',
      description: '그룹과 프로젝트 관리',
      icon: <FolderIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      path: '/groups-projects'
    },
    {
      title: 'Bulk Import',
      description: 'YAML로 대량 생성',
      icon: <UploadFileIcon sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      path: '/bulk-import'
    },
    {
      title: 'System Health',
      description: 'GitLab 상태 확인',
      icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
      color: '#f57c00',
      path: '/system-health'
    }
  ];

  const gettingStartedSteps = [
    { text: 'GitLab 토큰으로 로그인', completed: true },
    { text: 'Groups & Projects에서 구조 확인', completed: true },
    { text: 'Bulk Import로 리소스 생성', completed: false },
    { text: 'System Health에서 상태 모니터링', completed: false }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('dashboard.title', 'Dashboard')}
      </Typography>
      
      {/* 사용자 환영 메시지 */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" gutterBottom>
          환영합니다{user?.username && `, ${user.username}`}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          GitLab Bulk Manager로 그룹과 프로젝트를 효율적으로 관리하세요.
        </Typography>
      </Paper>

      {/* Permission Tree */}
      <Box sx={{ mb: 3 }}>
        <PermissionTree />
      </Box>

      <Grid container spacing={3}>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            {quickActions.map((action) => (
              <Grid item xs={12} sm={6} md={4} key={action.path}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                  onClick={() => navigate(action.path)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ 
                        bgcolor: action.color, 
                        color: 'white',
                        p: 1.5,
                        borderRadius: 2,
                        display: 'flex',
                        mr: 2
                      }}>
                        {action.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6">
                          {action.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Getting Started */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <RocketLaunchIcon sx={{ mr: 1 }} />
              <Typography variant="h6">
                Getting Started
              </Typography>
            </Box>
            <List>
              {gettingStartedSteps.map((step, index) => (
                <ListItem key={index} dense>
                  <ListItemIcon>
                    <CheckCircleIcon 
                      color={step.completed ? 'success' : 'action'} 
                      sx={{ opacity: step.completed ? 1 : 0.3 }}
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={step.text}
                    sx={{ 
                      textDecoration: step.completed ? 'line-through' : 'none',
                      opacity: step.completed ? 0.7 : 1
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* 새로운 기능 안내 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', bgcolor: 'info.50' }}>
            <Typography variant="h6" gutterBottom>
              ✨ 새로운 기능
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CodeIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="YAML Editor"
                  secondary="YAML 파일로 대량 작업을 정의하고 실행"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <GroupIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Visual Builder"
                  secondary="드래그 앤 드롭으로 계층 구조 생성"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <HealthAndSafetyIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary="System Health"
                  secondary="GitLab 인스턴스 상태 실시간 모니터링"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};