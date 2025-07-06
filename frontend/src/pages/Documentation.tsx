import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { DocumentationViewer } from '../components/DocumentationViewer';

const drawerWidth = 280;

interface DocSection {
  id: string;
  title: string;
  description: string;
}

const docSections: DocSection[] = [
  {
    id: 'README',
    title: 'Overview',
    description: 'Introduction to GitLab Bulk Manager documentation',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Quick start guide for new users',
  },
  {
    id: 'features',
    title: 'Features',
    description: 'Overview of all available features',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    description: 'System architecture and design patterns',
  },
  {
    id: 'components',
    title: 'Components',
    description: 'UI component documentation',
  },
  {
    id: 'api-integration',
    title: 'API Integration',
    description: 'GitLab API integration guide',
  },
  {
    id: 'development',
    title: 'Development',
    description: 'Development setup and guidelines',
  },
  {
    id: 'testing',
    title: 'Testing',
    description: 'Testing strategies and guidelines',
  },
  {
    id: 'deployment',
    title: 'Deployment',
    description: 'Deployment and configuration guide',
  },
];

export const Documentation: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedDoc, setSelectedDoc] = useState<string>('README');
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDocSelect = (docId: string) => {
    setSelectedDoc(docId);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Documentation
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {docSections.map((section) => (
          <ListItem key={section.id} disablePadding>
            <ListItemButton
              selected={selectedDoc === section.id}
              onClick={() => handleDocSelect(section.id)}
            >
              <ListItemText
                primary={section.title}
                secondary={section.description}
                secondaryTypographyProps={{
                  variant: 'caption',
                  sx: { display: 'block', mt: 0.5 },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { md: 'none' }, position: 'absolute', top: 0, left: 0 }}
        >
          <MenuIcon />
        </IconButton>
      )}
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              position: isMobile ? 'fixed' : 'relative',
              height: isMobile ? '100%' : 'auto',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: isMobile ? 0 : `${drawerWidth}px`,
        }}
      >
        <DocumentationViewer docPath={selectedDoc} />
      </Box>
    </Box>
  );
};