import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Search,
  Home,
  Rocket,
  Star,
  Widgets,
  Api,
  Architecture,
  Code,
  BugReport,
  CloudUpload,
  MenuBook,
  Close,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface DocItem {
  title: string;
  slug: string;
  icon?: string;
}

interface DocSection {
  title: string;
  items: DocItem[];
}

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
  variant?: 'permanent' | 'temporary';
}

const iconMap: Record<string, React.ElementType> = {
  home: Home,
  rocket: Rocket,
  star: Star,
  widgets: Widgets,
  api: Api,
  architecture: Architecture,
  code: Code,
  bug_report: BugReport,
  cloud_upload: CloudUpload,
};

export const DocsSidebar: React.FC<DocsSidebarProps> = ({ 
  open = true, 
  onClose,
  variant = 'permanent' 
}) => {
  const [sections, setSections] = useState<DocSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    // Load documentation manifest
    fetch('/docs/manifest.json')
      .then(res => res.json())
      .then(data => {
        setSections(data);
        // Expand all sections by default
        setExpandedSections(data.map((section: DocSection) => section.title));
      })
      .catch(err => console.error('Failed to load docs manifest:', err));
  }, []);

  const handleSectionClick = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleItemClick = (slug: string) => {
    navigate(`/docs/${slug}`);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const isItemActive = (slug: string) => {
    return location.pathname === `/docs/${slug}`;
  };

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(section => section.items.length > 0);

  const sidebarContent = (
    <Box sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MenuBook color="primary" />
          <Typography variant="h6">문서</Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      {/* Search */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="문서 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List component="nav" sx={{ px: 1 }}>
          {filteredSections.map((section) => (
            <React.Fragment key={section.title}>
              <ListItemButton
                onClick={() => handleSectionClick(section.title)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemText 
                  primary={section.title}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                {expandedSections.includes(section.title) ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={expandedSections.includes(section.title)} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {section.items.map((item) => {
                    const Icon = item.icon ? iconMap[item.icon] : null;
                    return (
                      <ListItemButton
                        key={item.slug}
                        sx={{ 
                          pl: 4, 
                          borderRadius: 1, 
                          mb: 0.5,
                          bgcolor: isItemActive(item.slug) ? 'action.selected' : 'transparent',
                          '&:hover': {
                            bgcolor: isItemActive(item.slug) ? 'action.selected' : 'action.hover',
                          },
                        }}
                        onClick={() => handleItemClick(item.slug)}
                      >
                        {Icon && (
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Icon fontSize="small" />
                          </ListItemIcon>
                        )}
                        <ListItemText 
                          primary={item.title}
                          primaryTypographyProps={{ 
                            fontSize: '0.875rem',
                            fontWeight: isItemActive(item.slug) ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          ))}
        </List>
      </Box>
    </Box>
  );

  if (variant === 'temporary') {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return sidebarContent;
};