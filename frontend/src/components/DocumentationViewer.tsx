import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { Box, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import mermaid from 'mermaid';
import 'react-syntax-highlighter/dist/esm/styles/hljs/github';

interface DocumentationViewerProps {
  docPath: string;
}

const MarkdownContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '100%',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4),
  },
  [theme.breakpoints.up('lg')]: {
    padding: theme.spacing(5),
  },
  height: '100%',
  overflow: 'auto',
  // Force all content to use full width
  '& > *': {
    maxWidth: '100% !important',
    width: '100% !important',
  },
  '& h1': {
    fontSize: '2.5rem',
    fontWeight: 600,
    marginBottom: theme.spacing(3),
    color: theme.palette.primary.main,
  },
  '& h2': {
    fontSize: '2rem',
    fontWeight: 500,
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  '& h3': {
    fontSize: '1.5rem',
    fontWeight: 500,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  '& h4': {
    fontSize: '1.25rem',
    fontWeight: 500,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  '& p': {
    marginBottom: theme.spacing(2),
    lineHeight: 1.7,
  },
  '& ul, & ol': {
    marginBottom: theme.spacing(2),
    paddingLeft: theme.spacing(4),
  },
  '& li': {
    marginBottom: theme.spacing(1),
    lineHeight: 1.6,
  },
  '& code': {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: '0.9em',
  },
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : '#f6f8fa',
    color: theme.palette.mode === 'dark' ? theme.palette.common.white : '#24292e',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    marginBottom: theme.spacing(2),
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
      color: 'inherit',
    },
  },
  '& blockquote': {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    paddingLeft: theme.spacing(2),
    marginLeft: 0,
    marginBottom: theme.spacing(2),
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: theme.spacing(2),
  },
  '& th, & td': {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
    textAlign: 'left',
  },
  '& th': {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
    fontWeight: 600,
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '& hr': {
    margin: theme.spacing(3, 0),
    border: 'none',
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  '& .mermaid': {
    textAlign: 'center',
    marginBottom: theme.spacing(2),
    '& svg': {
      maxWidth: '100%',
    },
  },
}));

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#2196f3',
    primaryTextColor: '#000',
    primaryBorderColor: '#1976d2',
    lineColor: '#5a6c7d',
    secondaryColor: '#f50057',
    tertiaryColor: '#fff',
  },
  securityLevel: 'loose',
});

// Custom code component to handle mermaid diagrams
const CodeComponent = ({ inline, className, children, ...props }: any) => {
  const [diagram, setDiagram] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  useEffect(() => {
    if (!inline && lang === 'mermaid' && children) {
      setIsLoading(true);
      const renderDiagram = async () => {
        try {
          const graphDefinition = Array.isArray(children) ? children.join('') : String(children);
          // Clean up the definition
          const cleanDefinition = graphDefinition.replace(/\n$/, '').trim();
          // Generate unique ID to avoid conflicts
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Clear any previous diagrams with the same ID
          const existingElement = document.getElementById(id);
          if (existingElement) {
            existingElement.remove();
          }
          
          const { svg } = await mermaid.render(id, cleanDefinition);
          setDiagram(svg);
          setIsLoading(false);
        } catch (error) {
          console.error('Mermaid render error:', error);
          setIsLoading(false);
          // Don't retry, just show the code
        }
      };
      renderDiagram();
    }
  }, [inline, lang, children]);

  if (!inline && lang === 'mermaid') {
    if (diagram && !isLoading) {
      return (
        <div className="mermaid" dangerouslySetInnerHTML={{ __html: diagram }} />
      );
    } else {
      // Show the raw mermaid code while loading or if error
      return (
        <pre className={className} {...props}>
          <code>{children}</code>
        </pre>
      );
    }
  }

  // For inline code or non-mermaid blocks
  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  // For non-mermaid code blocks
  return (
    <pre className={className} {...props}>
      <code>{children}</code>
    </pre>
  );
};

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({ docPath }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch documentation from backend API
        const response = await fetch(`/api/docs/${docPath}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Documentation not found: ${docPath}`);
          }
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }
        
        const data = await response.json();
        setContent(data.content || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    if (docPath) {
      loadDocument();
    }
  }, [docPath]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <MarkdownContainer>
      <ReactMarkdown
        children={content}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ node, className, children, ...props }: any) => {
            const inline = props.inline;
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            
            if (!inline && lang === 'mermaid') {
              return <CodeComponent inline={false} className={className} {...props}>{children}</CodeComponent>;
            }
            
            if (!inline && lang) {
              return (
                <pre className={className}>
                  <code {...props}>{children}</code>
                </pre>
              );
            }
            
            return <code className={className} {...props}>{children}</code>;
          },
          // Ensure links work properly
          a: ({ node, href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          // Handle HTML blocks properly
          div: ({ node, ...props }) => <div {...props} />,
          // Ensure tables render properly
          table: ({ node, ...props }) => <table {...props} />,
          thead: ({ node, ...props }) => <thead {...props} />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr {...props} />,
          th: ({ node, ...props }) => <th {...props} />,
          td: ({ node, ...props }) => <td {...props} />,
        }}
      />
    </MarkdownContainer>
  );
};