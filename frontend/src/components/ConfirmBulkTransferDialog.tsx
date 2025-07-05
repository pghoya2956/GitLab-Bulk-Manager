import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  path: string;
  full_path: string;
  visibility?: string;
}

interface ConfirmBulkTransferDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceNodes: TreeNode[];
  targetNode: TreeNode | null;
  loading?: boolean;
}

export const ConfirmBulkTransferDialog: React.FC<ConfirmBulkTransferDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sourceNodes,
  targetNode,
  loading = false,
}) => {
  if (!targetNode || sourceNodes.length === 0) return null;

  const groupCount = sourceNodes.filter(n => n.type === 'group').length;
  const projectCount = sourceNodes.filter(n => n.type === 'project').length;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Move {sourceNodes.length} Items</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body1" gutterBottom>
            Are you sure you want to move the selected items?
          </Typography>
          
          {groupCount > 0 && (
            <Alert severity="warning" sx={{ my: 2 }}>
              Moving {groupCount} group{groupCount > 1 ? 's' : ''} will also move all their subgroups and projects.
            </Alert>
          )}

          <Box sx={{ my: 3 }}>
            {/* Source Items Summary */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Moving {sourceNodes.length} item{sourceNodes.length > 1 ? 's' : ''}:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                {groupCount > 0 && (
                  <Chip 
                    icon={<FolderIcon />} 
                    label={`${groupCount} Group${groupCount > 1 ? 's' : ''}`} 
                    color="warning"
                    size="small"
                  />
                )}
                {projectCount > 0 && (
                  <Chip 
                    icon={<CodeIcon />} 
                    label={`${projectCount} Project${projectCount > 1 ? 's' : ''}`} 
                    color="primary"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            {/* Show first few items */}
            <Box sx={{ maxHeight: 150, overflow: 'auto', mb: 2 }}>
              <List dense>
                {sourceNodes.slice(0, 5).map((node) => (
                  <ListItem key={node.id} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {node.type === 'group' ? 
                        <FolderIcon fontSize="small" color="warning" /> : 
                        <CodeIcon fontSize="small" color="primary" />
                      }
                    </ListItemIcon>
                    <ListItemText 
                      primary={node.name}
                      secondary={node.full_path}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
                {sourceNodes.length > 5 && (
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary={`... and ${sourceNodes.length - 5} more`}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    />
                  </ListItem>
                )}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Arrow */}
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <ArrowForwardIcon color="action" />
            </Box>

            {/* Target */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FolderIcon sx={{ mr: 1, color: 'warning.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {targetNode.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {targetNode.full_path}
                </Typography>
              </Box>
              {targetNode.visibility && (
                <Chip label={targetNode.visibility} size="small" variant="outlined" />
              )}
            </Box>
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          {loading ? `Moving ${sourceNodes.length} items...` : `Move ${sourceNodes.length} items`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};