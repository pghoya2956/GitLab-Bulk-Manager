/**
 * Action History Sidebar Component
 * Shows the history of bulk operations with undo/redo capabilities
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Button,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  ContentCopy as CloneIcon,
  DriveFileMove as TransferIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface HistoryAction {
  id: string;
  type: string;
  description: string;
  timestamp?: string;
  items?: any[];
  metadata?: any;
  undoable?: boolean;
}

interface ActionHistorySidebarProps {
  open?: boolean;
  onClose?: () => void;
  actions?: HistoryAction[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // Legacy props from BulkActionsCenter
  history?: HistoryAction[];
  runningCount?: number;
  onClear?: () => void;
  onRefresh?: () => void;
}

export const ActionHistorySidebar: React.FC<ActionHistorySidebarProps> = ({
  open = false,
  onClose = () => {},
  actions,
  onUndo = () => {},
  onRedo = () => {},
  canUndo = false,
  canRedo = false,
  // Legacy props
  history,
  runningCount: _runningCount,
  onClear: _onClear,
  onRefresh: _onRefresh,
}) => {
  // Use history if actions not provided (backward compatibility)
  const actionList = actions || history || [];
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'delete':
        return <DeleteIcon color="error" />;
      case 'archive':
        return <ArchiveIcon color="action" />;
      case 'unarchive':
        return <UnarchiveIcon color="action" />;
      case 'clone':
        return <CloneIcon color="primary" />;
      case 'transfer':
        return <TransferIcon color="primary" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Action History</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UndoIcon />}
            onClick={onUndo}
            disabled={!canUndo}
            size="small"
            fullWidth
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            startIcon={<RedoIcon />}
            onClick={onRedo}
            disabled={!canRedo}
            size="small"
            fullWidth
          >
            Redo
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {actionList.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No actions yet
            </Typography>
          </Box>
        ) : (
          <List>
            {actionList.map((action, index) => (
              <ListItem key={action.id || index} alignItems="flex-start">
                <ListItemIcon>{getActionIcon(action.type)}</ListItemIcon>
                <ListItemText
                  primary={action.description}
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {action.timestamp && (
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(action.timestamp)}
                        </Typography>
                      )}
                      {action.undoable && (
                        <Chip
                          label="Undoable"
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
};

export default ActionHistorySidebar;