import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { gitlabService } from '../services/gitlab';
import { useNotification } from '../hooks/useNotification';
import { getErrorMessage } from '../utils/errorHandler';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (group?: any) => void;
  parentGroup?: { id: number; name: string };
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({
  open,
  onClose,
  onSuccess,
  parentGroup,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    visibility: 'private',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = {
        ...formData,
        path: formData.path || formData.name.toLowerCase().replace(/\s+/g, '-'),
        parent_id: parentGroup?.id,
      };
      
      const createdGroup = await gitlabService.createGroup(data);
      showSuccess(`Group "${formData.name}" created successfully`);
      onSuccess(createdGroup);
      handleClose();
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      path: '',
      description: '',
      visibility: 'private',
    });
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Create New Group
        {parentGroup && (
          <div style={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            Parent: {parentGroup.name}
          </div>
        )}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Group Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="normal"
          required
          autoFocus
        />
        <TextField
          fullWidth
          label="Group Path (URL)"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          margin="normal"
          helperText="Leave empty to auto-generate from name"
        />
        <TextField
          fullWidth
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          margin="normal"
          multiline
          rows={3}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Visibility</InputLabel>
          <Select
            value={formData.visibility}
            onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
            label="Visibility"
          >
            <MenuItem value="private">Private</MenuItem>
            <MenuItem value="internal">Internal</MenuItem>
            <MenuItem value="public">Public</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.name}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};