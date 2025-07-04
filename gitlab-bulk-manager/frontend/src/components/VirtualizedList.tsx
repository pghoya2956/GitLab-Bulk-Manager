import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Chip, 
  IconButton,
  Box,
  useTheme,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface VirtualizedItem {
  id: number | string;
  name: string;
  path: string;
  full_path: string;
  type?: 'group' | 'project';
  visibility?: string;
  description?: string;
}

interface VirtualizedListProps {
  items: VirtualizedItem[];
  height: number;
  itemHeight?: number;
  onItemClick?: (item: VirtualizedItem) => void;
  onMenuClick?: (event: React.MouseEvent<HTMLElement>, item: VirtualizedItem) => void;
  onDragStart?: (event: React.DragEvent, item: VirtualizedItem) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent, item: VirtualizedItem) => void;
  draggable?: boolean;
  showIcon?: boolean;
}

export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  items,
  height,
  itemHeight = 70,
  onItemClick,
  onMenuClick,
  onDragStart,
  onDragOver,
  onDrop,
  draggable = false,
  showIcon = true,
}) => {
  const theme = useTheme();

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    
    return (
      <div style={style}>
        <ListItem
          button
          onClick={() => onItemClick?.(item)}
          onDragStart={draggable ? (e) => onDragStart?.(e, item) : undefined}
          onDragOver={draggable ? onDragOver : undefined}
          onDrop={draggable ? (e) => onDrop?.(e, item) : undefined}
          draggable={draggable}
          sx={{
            height: itemHeight,
            borderBottom: `1px solid ${theme.palette.divider}`,
            cursor: draggable ? 'move' : 'pointer',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&:last-child': {
              borderBottom: 'none',
            },
          }}
        >
          {draggable && (
            <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
          )}
          
          {showIcon && (
            <ListItemIcon>
              {item.type === 'project' ? (
                <CodeIcon color="primary" />
              ) : (
                <FolderIcon />
              )}
            </ListItemIcon>
          )}
          
          <ListItemText
            primary={item.name}
            secondary={item.full_path || item.path}
            primaryTypographyProps={{
              noWrap: true,
              sx: { fontWeight: 500 }
            }}
            secondaryTypographyProps={{
              noWrap: true,
              sx: { fontSize: '0.875rem' }
            }}
          />
          
          {item.visibility && (
            <Chip 
              label={item.visibility} 
              size="small" 
              sx={{ mr: 1 }}
              variant="outlined"
            />
          )}
          
          {onMenuClick && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e, item);
              }}
              sx={{ ml: 1 }}
            >
              <MoreVertIcon />
            </IconButton>
          )}
        </ListItem>
      </div>
    );
  };

  return (
    <Box sx={{ height, width: '100%' }}>
      <List
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        width="100%"
      >
        {Row}
      </List>
    </Box>
  );
};