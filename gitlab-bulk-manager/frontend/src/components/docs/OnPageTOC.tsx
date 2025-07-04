import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Paper,
} from '@mui/material';
import { Article } from '@mui/icons-material';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface OnPageTOCProps {
  headings: Heading[];
}

export const OnPageTOC: React.FC<OnPageTOCProps> = ({ headings }) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0% -80% 0%',
        threshold: 0,
      }
    );

    // Observe all headings
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // Offset for fixed header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Filter to show only h2 and h3
  const filteredHeadings = headings.filter(h => h.level === 2 || h.level === 3);

  if (filteredHeadings.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'sticky',
        top: 80,
        p: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Article fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={600}>
          이 페이지의 내용
        </Typography>
      </Box>
      
      <List dense sx={{ p: 0 }}>
        {filteredHeadings.map((heading) => (
          <ListItemButton
            key={heading.id}
            onClick={() => handleClick(heading.id)}
            selected={activeId === heading.id}
            sx={{
              py: 0.5,
              pl: heading.level === 3 ? 3 : 1,
              borderRadius: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.50',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.100',
                },
              },
            }}
          >
            <ListItemText
              primary={heading.text}
              primaryTypographyProps={{
                fontSize: heading.level === 3 ? '0.813rem' : '0.875rem',
                fontWeight: activeId === heading.id ? 600 : 400,
                color: activeId === heading.id ? 'primary.main' : 'text.secondary',
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
};