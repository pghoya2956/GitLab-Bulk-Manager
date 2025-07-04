import React from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Button, IconButton, Menu, MenuItem } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { logout } from '../store/slices/authSlice';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { DocsSearch } from './docs/DocsSearch';
import { NotificationCenter } from './NotificationCenter';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      // Call backend logout endpoint
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Clear frontend state regardless of backend response
    dispatch(logout());
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            GitLab Bulk Manager
          </Typography>
          <Button color="inherit" onClick={() => navigate('/dashboard')}>Dashboard</Button>
          <Button color="inherit" onClick={() => navigate('/groups')}>Groups</Button>
          <Button color="inherit" onClick={() => navigate('/projects')}>Projects</Button>
          <Button color="inherit" onClick={() => navigate('/bulk-operations')}>Bulk Operations</Button>
          <Button color="inherit" onClick={() => navigate('/jobs')}>Jobs</Button>
          <Button color="inherit" onClick={() => navigate('/backup-restore')}>Backup</Button>
          <Button color="inherit" onClick={() => navigate('/monitoring')}>Monitoring</Button>
          <Button color="inherit" onClick={() => navigate('/docs')}>Docs</Button>
          <Box sx={{ mx: 2 }}>
            <DocsSearch />
          </Box>
          <NotificationCenter />
          <IconButton
            size="large"
            onClick={handleMenu}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ mt: 4, mb: 4, flex: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
};