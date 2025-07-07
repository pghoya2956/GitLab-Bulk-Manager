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

interface ConfirmTransferDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceNode: TreeNode | null;
  targetNode: TreeNode | null;
  loading?: boolean;
}

export const ConfirmTransferDialog: React.FC<ConfirmTransferDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sourceNode,
  targetNode,
  loading = false,
}) => {
  if (!sourceNode || !targetNode) {return null;}

  const isGroupTransfer = sourceNode.type === 'group';
  const title = isGroupTransfer ? 'Move Group' : 'Move Project';
  const itemType = isGroupTransfer ? 'group' : 'project';

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body1" gutterBottom>
            Are you sure you want to move this {itemType}?
          </Typography>
          
          {isGroupTransfer && (
            <Alert severity="warning" sx={{ my: 2 }}>
              Moving a group will also move all its subgroups and projects.
            </Alert>
          )}

          <Box sx={{ my: 3 }}>
            {/* Source */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {sourceNode.type === 'group' ? (
                <FolderIcon sx={{ mr: 1, color: 'text.secondary' }} />
              ) : (
                <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
              )}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {sourceNode.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {sourceNode.full_path}
                </Typography>
              </Box>
              {sourceNode.visibility && (
                <Chip label={sourceNode.visibility} size="small" variant="outlined" />
              )}
            </Box>

            {/* Arrow */}
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <ArrowForwardIcon color="action" />
            </Box>

            {/* Target */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FolderIcon sx={{ mr: 1, color: 'text.secondary' }} />
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

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            New path will be: {targetNode.full_path}/{sourceNode.path}
          </Typography>
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
          {loading ? 'Moving...' : 'Confirm Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};