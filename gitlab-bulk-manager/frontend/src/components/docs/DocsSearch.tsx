import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  useTheme,
  useMediaQuery,
  ClickAwayListener,
  Popper,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  Article,
  Close,
  Folder,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';

interface SearchResult {
  slug: string;
  title: string;
  section: string;
  content: string;
  excerpt: string;
}

interface DocsSearchProps {
  fullScreen?: boolean;
}

export const DocsSearch: React.FC<DocsSearchProps> = ({ fullScreen = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
  const [fuse, setFuse] = useState<Fuse<SearchResult> | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load search index
    fetch('/docs/search-index.json')
      .then(res => res.json())
      .then(data => {
        setSearchIndex(data);
        // Initialize Fuse.js
        const fuseInstance = new Fuse(data, {
          keys: ['title', 'content', 'section'],
          includeScore: true,
          threshold: 0.3,
          includeMatches: true,
          minMatchCharLength: 2,
          ignoreLocation: true,
        });
        setFuse(fuseInstance);
      })
      .catch(err => console.error('Failed to load search index:', err));
  }, []);

  useEffect(() => {
    if (query && fuse) {
      const searchResults = fuse.search(query);
      setResults(searchResults.slice(0, 5).map(result => result.item));
    } else {
      setResults([]);
    }
  }, [query, fuse]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleResultClick = (slug: string) => {
    navigate(`/docs/${slug}`);
    handleClose();
  };

  const highlightMatch = (text: string, matches?: any[]) => {
    if (!matches) return text;
    
    // Simple highlighting for now
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <Box component="mark" sx={{ bgcolor: 'primary.100', color: 'primary.main' }}>
          {text.substring(index, index + query.length)}
        </Box>
        {text.substring(index + query.length)}
      </>
    );
  };

  const searchContent = (
    <>
      <TextField
        fullWidth
        placeholder="문서 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: query && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setQuery('')}>
                <Close fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />
      
      {results.length > 0 ? (
        <List sx={{ p: 0 }}>
          {results.map((result) => (
            <ListItem
              key={result.slug}
              button
              onClick={() => handleResultClick(result.slug)}
              sx={{
                borderRadius: 1,
                mb: 1,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon>
                <Article color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {highlightMatch(result.title)}
                    </Typography>
                    <Chip
                      icon={<Folder fontSize="small" />}
                      label={result.section}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {highlightMatch(result.excerpt)}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      ) : query ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            '{query}'에 대한 검색 결과가 없습니다
          </Typography>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            문서를 검색하려면 키워드를 입력하세요
          </Typography>
        </Box>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <>
        <Box ref={anchorRef}>
          <TextField
            size="small"
            placeholder="문서 검색..."
            onClick={handleOpen}
            InputProps={{
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: isMobile ? 150 : 200 }}
          />
        </Box>
        
        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              position: 'absolute',
              top: '10%',
              m: 2,
            },
          }}
        >
          <DialogContent>
            {searchContent}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box>
        <TextField
          ref={anchorRef}
          size="small"
          placeholder="문서 검색..."
          onClick={handleOpen}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: isMobile ? 150 : 200 }}
        />
        
        <Popper
          open={open && (query.length > 0 || results.length > 0)}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          style={{ zIndex: theme.zIndex.modal }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={350}>
              <Paper
                elevation={8}
                sx={{
                  mt: 1,
                  p: 2,
                  width: isMobile ? 300 : 400,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {searchContent}
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};