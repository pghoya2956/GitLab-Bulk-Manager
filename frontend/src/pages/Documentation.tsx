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
  // Getting Started
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
  // Architecture & Design
  {
    id: 'architecture',
    title: 'Architecture',
    titleKo: '아키텍처',
    description: 'System architecture and design patterns',
    descriptionKo: '시스템 아키텍처 및 설계 패턴',
    category: 'architecture',
  },
  {
    id: 'components',
    title: 'Components',
    titleKo: '컴포넌트',
    description: 'UI component documentation',
    descriptionKo: 'UI 컴포넌트 문서',
    category: 'architecture',
  },
  {
    id: 'api-integration',
    title: 'API Integration',
    titleKo: 'API 통합',
    description: 'GitLab API integration guide',
    descriptionKo: 'GitLab API 통합 가이드',
    category: 'architecture',
  },
  // Features
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
  // Development & Testing
  {
    id: 'development',
    title: 'Development',
    titleKo: '개발',
    description: 'Development setup and guidelines',
    descriptionKo: '개발 설정 및 가이드라인',
    category: 'development',
  },
  {
    id: 'testing',
    title: 'Testing',
    titleKo: '테스팅',
    description: 'Testing strategies and guidelines',
    descriptionKo: '테스팅 전략 및 가이드라인',
    category: 'development',
  },
  {
    id: 'deployment',
    title: 'Deployment',
    titleKo: '배포',
    description: 'Deployment and configuration guide',
    descriptionKo: '배포 및 구성 가이드',
    category: 'development',
  },
  // Reference
  {
    id: 'api-reference',
    title: 'API Reference',
    titleKo: 'API 레퍼런스',
    description: 'Complete API endpoint documentation',
    descriptionKo: '전체 API 엔드포인트 문서',
    category: 'reference',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    titleKo: '문제 해결',
    description: 'Common issues and solutions',
    descriptionKo: '일반적인 문제와 해결책',
    category: 'reference',
  },
];

const categories = [
  { id: 'getting-started', title: 'Getting Started', titleKo: '시작하기' },
  { id: 'architecture', title: 'Architecture & Design', titleKo: '아키텍처 & 설계' },
  { id: 'features', title: 'Features', titleKo: '기능' },
  { id: 'development', title: 'Development & Testing', titleKo: '개발 & 테스팅' },
  { id: 'reference', title: 'Reference', titleKo: '레퍼런스' },
];

export const Documentation: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedDoc, setSelectedDoc] = useState<string>('README');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['getting-started']);

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
    return `ko/${selectedDoc}`;
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Stack spacing={2} sx={{ width: '100%' }}>
          <Typography variant="h6" noWrap component="div">
            문서
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
      <List>
        {categories.map((category) => (
          <React.Fragment key={category.id}>
            <ListItemButton onClick={() => handleCategoryToggle(category.id)}>
              <ListItemText 
                primary={category.titleKo}
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
                          primary={section.titleKo}
                          secondary={section.descriptionKo}
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