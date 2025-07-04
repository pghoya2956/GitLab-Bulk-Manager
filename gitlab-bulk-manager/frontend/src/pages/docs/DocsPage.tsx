import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { NavigateNext, Error as ErrorIcon } from '@mui/icons-material';
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom';
import { MarkdownRenderer } from '../../components/docs/MarkdownRenderer';
import { OnPageTOC } from '../../components/docs/OnPageTOC';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export const DocsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  // If no slug, redirect to introduction
  if (!slug) {
    return <Navigate to="/docs/README" replace />;
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHeadings([]);

    fetch(`/docs/${slug}.md`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Document not found');
        }
        return response.text();
      })
      .then(text => {
        setContent(text);
        // Extract headings for TOC
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const extractedHeadings: Heading[] = [];
        let match;
        
        while ((match = headingRegex.exec(text)) !== null) {
          const level = match[1].length;
          const text = match[2];
          const id = text
            .toLowerCase()
            .replace(/[^\w\s가-힣]/gi, '')
            .replace(/\s+/g, '-');
          
          extractedHeadings.push({ id, text, level });
        }
        
        setHeadings(extractedHeadings);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  const getPageTitle = () => {
    // Extract first h1 from content
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : slug;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="h6" gutterBottom>문서를 찾을 수 없습니다</Typography>
          <Typography variant="body2">
            요청하신 문서 '{slug}'를 찾을 수 없습니다. URL을 확인해주세요.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" />}
        aria-label="breadcrumb"
        sx={{ mb: 3 }}
      >
        <Link
          component={RouterLink}
          to="/dashboard"
          color="inherit"
          underline="hover"
        >
          홈
        </Link>
        <Link
          component={RouterLink}
          to="/docs"
          color="inherit"
          underline="hover"
        >
          문서
        </Link>
        <Typography color="text.primary">{getPageTitle()}</Typography>
      </Breadcrumbs>

      <Grid container spacing={3}>
        {/* Main content */}
        <Grid item xs={12} lg={isMobile ? 12 : 9}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              minHeight: '60vh',
            }}
          >
            <MarkdownRenderer 
              content={content}
              onHeadingFound={setHeadings}
            />
          </Paper>
        </Grid>

        {/* Table of Contents */}
        {!isMobile && headings.length > 0 && (
          <Grid item lg={3}>
            <OnPageTOC headings={headings} />
          </Grid>
        )}
      </Grid>
    </>
  );
};