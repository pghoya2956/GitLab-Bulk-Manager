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
  useTheme,
  useMediaQuery,
  IconButton,
  Stack,
  Collapse,
  ListItemIcon,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import { DocumentationViewer } from '../components/DocumentationViewer';

const drawerWidth = 320;

interface DocSection {
  id: string;
  title: string;
  titleKo: string;
  description: string;
  descriptionKo: string;
  category?: string;
}

const docSections: DocSection[] = [
  // 시작하기
  {
    id: 'README',
    title: 'Overview',
    titleKo: '개요',
    description: 'Introduction to GitLab Bulk Manager',
    descriptionKo: 'GitLab Bulk Manager 소개',
    category: 'getting-started',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    titleKo: '시작하기',
    description: 'Quick start guide for new users',
    descriptionKo: '신규 사용자를 위한 빠른 시작 가이드',
    category: 'getting-started',
  },
  // 기능 가이드
  {
    id: 'features',
    title: 'Features',
    titleKo: '기능',
    description: 'Overview of all available features',
    descriptionKo: '사용 가능한 모든 기능 개요',
    category: 'features',
  },
  {
    id: 'permission-tree',
    title: 'Permission Tree',
    titleKo: '권한 트리',
    description: 'User permissions visualization',
    descriptionKo: '사용자 권한 시각화',
    category: 'features',
  },
  // 도움말
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    titleKo: '문제 해결',
    description: 'Common issues and solutions',
    descriptionKo: '일반적인 문제와 해결책',
    category: 'help',
  },
];

const categories = [
  { id: 'getting-started', title: 'Getting Started', titleKo: '시작하기' },
  { id: 'features', title: 'Features', titleKo: '기능 가이드' },
  { id: 'help', title: 'Help', titleKo: '도움말' },
];

export const Documentation: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedDoc, setSelectedDoc] = useState<string>('README');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['getting-started']);
  const [language, setLanguage] = useState<'ko' | 'en'>('ko');

  const handleLanguageChange = (_: React.MouseEvent<HTMLElement>, newLanguage: 'ko' | 'en' | null) => {
    if (newLanguage !== null) {
      setLanguage(newLanguage);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDocSelect = (docId: string) => {
    setSelectedDoc(docId);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setOpenCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getDocPath = () => {
    return `${language}/${selectedDoc}`;
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Stack spacing={1} sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" noWrap component="div">
              {language === 'ko' ? '문서' : 'Documentation'}
            </Typography>
            <ToggleButtonGroup
              value={language}
              exclusive
              onChange={handleLanguageChange}
              size="small"
              sx={{ ml: 1 }}
            >
              <ToggleButton value="ko" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
                한국어
              </ToggleButton>
              <ToggleButton value="en" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
                English
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </Toolbar>
      <Divider />
      <List>
        {categories.map((category) => (
          <React.Fragment key={category.id}>
            <ListItemButton onClick={() => handleCategoryToggle(category.id)}>
              <ListItemText
                primary={language === 'ko' ? category.titleKo : category.title}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              {openCategories.includes(category.id) ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={openCategories.includes(category.id)} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {docSections
                  .filter((section) => section.category === category.id)
                  .map((section) => (
                    <ListItem key={section.id} disablePadding>
                      <ListItemButton
                        sx={{ pl: 4 }}
                        selected={selectedDoc === section.id}
                        onClick={() => handleDocSelect(section.id)}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ArticleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={language === 'ko' ? section.titleKo : section.title}
                          secondary={language === 'ko' ? section.descriptionKo : section.description}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            sx: { display: 'block', mt: 0.5 },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
            </Collapse>
          </React.Fragment>
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
          width: '100%',
          height: '100%',
          overflow: 'auto',
        }}
      >
        <DocumentationViewer docPath={getDocPath()} />
      </Box>
    </Box>
  );
};