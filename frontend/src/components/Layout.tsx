import React from 'react';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, Menu, MenuItem } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { logout } from '../store/slices/authSlice';
import AccountCircle from '@mui/icons-material/AccountCircle';
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
          <Button color="inherit" onClick={() => navigate('/bulk-actions')} sx={{ fontWeight: 'bold', bgcolor: 'rgba(255,255,255,0.1)' }}>⚡ Bulk Actions</Button>
          <Button color="inherit" onClick={() => navigate('/system-health')}>시스템 상태</Button>
          <Button color="inherit" onClick={() => navigate('/docs')}>문서</Button>
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
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  );
};