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
  Autocomplete,
} from '@mui/material';
import { gitlabService } from '../services/gitlab';

interface Group {
  id: number;
  name: string;
  full_path: string;
}

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project?: any) => void;
  defaultGroup?: Group;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  defaultGroup,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    visibility: 'private',
    namespace_id: defaultGroup?.id || '',
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      loadGroups();
      if (defaultGroup) {
        setFormData(prev => ({ ...prev, namespace_id: defaultGroup.id }));
      }
    }
  }, [open, defaultGroup]);

  const loadGroups = async () => {
    try {
      const data = await gitlabService.getGroups({ per_page: 100 });
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!formData.namespace_id) {
        setError('Please select a group');
        return;
      }

      const data = {
        name: formData.name,
        path: formData.path || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        visibility: formData.visibility,
        namespace_id: Number(formData.namespace_id),
      };
      
      const createdProject = await gitlabService.createProject(data);
      onSuccess(createdProject);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create project');
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
      namespace_id: defaultGroup?.id || '',
    });
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Create New Project
        {defaultGroup && (
          <div style={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            in {defaultGroup.name}
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
          label="Project Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          margin="normal"
          required
          autoFocus
        />
        <TextField
          fullWidth
          label="Project Path (URL)"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          margin="normal"
          helperText="Leave empty to auto-generate from name"
        />
        <Autocomplete
          fullWidth
          options={groups}
          getOptionLabel={(option) => `${option.name} (${option.full_path})`}
          value={groups.find(g => g.id === formData.namespace_id) || null}
          onChange={(_, newValue) => {
            setFormData({ ...formData, namespace_id: newValue?.id || '' });
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Group"
              margin="normal"
              required
            />
          )}
          disabled={!!defaultGroup}
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
          disabled={loading || !formData.name || !formData.namespace_id}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};