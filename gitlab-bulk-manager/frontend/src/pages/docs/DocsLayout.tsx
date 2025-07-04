import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Menu } from '@mui/icons-material';
import { Outlet } from 'react-router-dom';
import { DocsSidebar } from '../../components/docs/DocsSidebar';

export const DocsLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Mobile menu button */}
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            left: 16,
            top: 80,
            zIndex: 1200,
            bgcolor: 'background.paper',
            boxShadow: 1,
          }}
        >
          <Menu />
        </IconButton>
      )}

      {/* Sidebar */}
      {isMobile ? (
        <DocsSidebar
          open={mobileOpen}
          onClose={handleDrawerToggle}
          variant="temporary"
        />
      ) : (
        <Paper
          sx={{
            width: 280,
            flexShrink: 0,
            height: 'calc(100vh - 64px)',
            position: 'sticky',
            top: 64,
            borderRadius: 0,
            borderRight: 1,
            borderColor: 'divider',
          }}
          elevation={0}
        >
          <DocsSidebar />
        </Paper>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};