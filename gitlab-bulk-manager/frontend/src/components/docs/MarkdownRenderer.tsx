import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Link,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Box,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface MarkdownRendererProps {
  content: string;
  onHeadingFound?: (headings: { id: string; text: string; level: number }[]) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onHeadingFound }) => {
  const headings: { id: string; text: string; level: number }[] = [];

  const generateId = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/gi, '')
      .replace(/\s+/g, '-');
  };

  React.useEffect(() => {
    if (onHeadingFound && headings.length > 0) {
      onHeadingFound(headings);
    }
  }, [content]);

  const components = {
    h1: ({ children, ...props }: any) => {
      const text = String(children);
      const id = generateId(text);
      headings.push({ id, text, level: 1 });
      return (
        <Typography id={id} variant="h3" component="h1" gutterBottom sx={{ mt: 4, mb: 2, fontWeight: 600 }} {...props}>
          {children}
        </Typography>
      );
    },
    h2: ({ children, ...props }: any) => {
      const text = String(children);
      const id = generateId(text);
      headings.push({ id, text, level: 2 });
      return (
        <Typography id={id} variant="h4" component="h2" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 500 }} {...props}>
          {children}
        </Typography>
      );
    },
    h3: ({ children, ...props }: any) => {
      const text = String(children);
      const id = generateId(text);
      headings.push({ id, text, level: 3 });
      return (
        <Typography id={id} variant="h5" component="h3" gutterBottom sx={{ mt: 2, mb: 1, fontWeight: 500 }} {...props}>
          {children}
        </Typography>
      );
    },
    h4: ({ children, ...props }: any) => (
      <Typography variant="h6" component="h4" gutterBottom sx={{ mt: 2, mb: 1 }} {...props}>
        {children}
      </Typography>
    ),
    p: ({ children, ...props }: any) => (
      <Typography paragraph sx={{ mb: 2, lineHeight: 1.7 }} {...props}>
        {children}
      </Typography>
    ),
    a: ({ href, children, ...props }: any) => {
      // Internal documentation links
      if (href?.startsWith('./') || href?.startsWith('../')) {
        const slug = href.replace(/^\.\//, '').replace(/\.md$/, '');
        return (
          <Link component={RouterLink} to={`/docs/${slug}`} {...props}>
            {children}
          </Link>
        );
      }
      // External links
      return (
        <Link href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </Link>
      );
    },
    ul: ({ children, ...props }: any) => (
      <List sx={{ pl: 2, mb: 2 }} {...props}>
        {children}
      </List>
    ),
    ol: ({ children, ...props }: any) => (
      <List component="ol" sx={{ pl: 2, mb: 2 }} {...props}>
        {children}
      </List>
    ),
    li: ({ children, ...props }: any) => (
      <ListItem sx={{ display: 'list-item', py: 0.5 }} {...props}>
        <ListItemText primary={children} />
      </ListItem>
    ),
    table: ({ children, ...props }: any) => (
      <Paper elevation={0} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
        <Table size="small" {...props}>
          {children}
        </Table>
      </Paper>
    ),
    thead: ({ children, ...props }: any) => <TableHead {...props}>{children}</TableHead>,
    tbody: ({ children, ...props }: any) => <TableBody {...props}>{children}</TableBody>,
    tr: ({ children, ...props }: any) => <TableRow {...props}>{children}</TableRow>,
    td: ({ children, ...props }: any) => (
      <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }} {...props}>
        {children}
      </TableCell>
    ),
    th: ({ children, ...props }: any) => (
      <TableCell component="th" sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }} {...props}>
        {children}
      </TableCell>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && language) {
        return (
          <Box sx={{ mb: 2 }}>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language}
              customStyle={{
                margin: 0,
                borderRadius: '8px',
                fontSize: '14px',
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </Box>
        );
      }

      return (
        <Chip
          label={children}
          size="small"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.875em',
            height: 'auto',
            py: 0.25,
            px: 0.75,
            bgcolor: 'grey.100',
          }}
          {...props}
        />
      );
    },
    blockquote: ({ children, ...props }: any) => (
      <Alert severity="info" sx={{ mb: 2 }} {...props}>
        {children}
      </Alert>
    ),
    hr: () => <Divider sx={{ my: 3 }} />,
    strong: ({ children, ...props }: any) => (
      <Typography component="span" fontWeight="bold" {...props}>
        {children}
      </Typography>
    ),
    em: ({ children, ...props }: any) => (
      <Typography component="span" fontStyle="italic" {...props}>
        {children}
      </Typography>
    ),
  };

  return (
    <Box sx={{ '& > *:first-of-type': { mt: 0 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};