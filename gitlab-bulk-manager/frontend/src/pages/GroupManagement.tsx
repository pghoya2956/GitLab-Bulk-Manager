import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Alert, Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { gitlabService } from '../services/gitlab';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { VirtualizedList } from '../components/VirtualizedList';

interface Group {
  id: number;
  name: string;
  path: string;
  full_path: string;
  description: string;
  visibility: string;
  parent_id: number | null;
}

export const GroupManagement: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<Group | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedParentGroup, setSelectedParentGroup] = useState<Group | undefined>(undefined);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await gitlabService.getGroups({ per_page: 100 });
      setGroups(data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Please login to view groups');
        // Redirect to login after a short delay
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, group: Group) => {
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetGroup: Group) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup.id === targetGroup.id) return;

    try {
      setError(null);
      await gitlabService.transferGroup(draggedGroup.id, targetGroup.id);
      await loadGroups(); // Reload to show updated hierarchy
    } catch (err: any) {
      setError(`Failed to move group: ${err.message}`);
    }
    setDraggedGroup(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, group: Group) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedGroup(group);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedGroup(null);
  };

  const handleCreateSubgroup = () => {
    setSelectedParentGroup(selectedGroup || undefined);
    setCreateDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !window.confirm(`Are you sure you want to delete "${selectedGroup.name}"?`)) {
      return;
    }

    try {
      setError(null);
      await gitlabService.deleteGroup(selectedGroup.id);
      await loadGroups();
    } catch (err: any) {
      setError(`Failed to delete group: ${err.message}`);
    }
    handleMenuClose();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">
          Group Management
        </Typography>
        <Button variant="contained" color="primary" onClick={() => setCreateDialogOpen(true)}>
          Create Group
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag and drop groups to reorganize hierarchy
        </Typography>
        
        {groups.length === 0 ? (
          <Typography>No groups found</Typography>
        ) : (
          <VirtualizedList
            items={groups}
            height={window.innerHeight - 350}
            itemHeight={70}
            onMenuClick={(e, group) => handleMenuOpen(e, group as Group)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            draggable
            showIcon
          />
        )}
      </Paper>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleCreateSubgroup}>Create Subgroup</MenuItem>
        <MenuItem onClick={handleDeleteGroup}>Delete Group</MenuItem>
      </Menu>

      <CreateGroupDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setSelectedParentGroup(undefined);
        }}
        onSuccess={loadGroups}
        parentGroup={selectedParentGroup}
      />
    </Box>
  );
};