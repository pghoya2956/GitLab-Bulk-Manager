import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Grid,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { gitlabService } from '../services/gitlab';
import { GitLabTree } from '../components/GitLabTree';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { useNotification } from '../hooks/useNotification';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  path: string;
  full_path: string;
  visibility?: string;
  description?: string;
  parent_id?: number | null;
  namespace?: any;
}

export const ProjectManagement: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useNotification();
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
  };

  const handleDragDrop = async (targetNode: TreeNode, draggedNode: TreeNode) => {
    try {
      const targetGroupId = parseInt(targetNode.id.replace('group-', ''));
      
      if (draggedNode.type === 'group') {
        const groupId = parseInt(draggedNode.id.replace('group-', ''));
        await gitlabService.transferGroup(groupId, targetGroupId);
        showSuccess(`Moved ${draggedNode.name} to ${targetNode.name}`);
      } else if (draggedNode.type === 'project') {
        const projectId = parseInt(draggedNode.id.replace('project-', ''));
        await gitlabService.transferProject(projectId, targetGroupId);
        showSuccess(`Moved ${draggedNode.name} to ${targetNode.name}`);
      }
      
      // Refresh tree
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to move item');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    
    const confirmMessage = selectedNode.type === 'group' 
      ? `Are you sure you want to delete the group "${selectedNode.name}"? This will also delete all subgroups and projects.`
      : `Are you sure you want to delete the project "${selectedNode.name}"?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      if (selectedNode.type === 'group') {
        const groupId = parseInt(selectedNode.id.replace('group-', ''));
        await gitlabService.deleteGroup(groupId);
        showSuccess(`Group "${selectedNode.name}" deleted successfully`);
      } else {
        const projectId = parseInt(selectedNode.id.replace('project-', ''));
        await gitlabService.deleteProject(projectId);
        showSuccess(`Project "${selectedNode.name}" deleted successfully`);
      }
      
      setSelectedNode(null);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to delete');
    }
    
    handleMenuClose();
  };

  const getSelectedGroup = () => {
    if (!selectedNode) return undefined;
    
    if (selectedNode.type === 'group') {
      return {
        id: parseInt(selectedNode.id.replace('group-', '')),
        name: selectedNode.name,
        full_path: selectedNode.full_path,
      };
    }
    
    // If a project is selected, use its namespace as the parent group
    if (selectedNode.namespace) {
      return {
        id: selectedNode.namespace.id,
        name: selectedNode.namespace.name,
        full_path: selectedNode.namespace.full_path,
      };
    }
    
    return undefined;
  };

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex' }}>
      {/* Left Panel - Tree View */}
      <Paper 
        sx={{ 
          width: 350, 
          height: '100%',
          borderRadius: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            Groups & Projects
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <GitLabTree
            key={refreshKey}
            onSelect={handleNodeSelect}
            onDrop={handleDragDrop}
            selectedNodeId={selectedNode?.id}
          />
        </Box>
      </Paper>

      {/* Right Panel - Details & Actions */}
      <Box sx={{ flexGrow: 1, height: '100%', overflow: 'auto' }}>
        {selectedNode ? (
          <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              {selectedNode.type === 'group' ? (
                <FolderIcon sx={{ fontSize: 40, mr: 2 }} />
              ) : (
                <CodeIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
              )}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4" gutterBottom>
                  {selectedNode.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedNode.full_path}
                </Typography>
              </Box>
              <Chip 
                label={selectedNode.visibility || 'private'} 
                color="primary" 
                variant="outlined"
                sx={{ mr: 2 }}
              />
              <IconButton onClick={handleMenuOpen}>
                <MoreVertIcon />
              </IconButton>
            </Box>

            {/* Description */}
            {selectedNode.description && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="body2">
                  {selectedNode.description}
                </Typography>
              </Paper>
            )}

            {/* Actions */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {selectedNode.type === 'group' && (
                <>
                  <Grid item>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateProjectOpen(true)}
                    >
                      Create Project
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateGroupOpen(true)}
                    >
                      Create Subgroup
                    </Button>
                  </Grid>
                </>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Additional Info */}
            <Typography variant="h6" gutterBottom>
              Details
            </Typography>
            <List>
              <ListItem>
                <ListItemText 
                  primary="Type" 
                  secondary={selectedNode.type === 'group' ? 'Group' : 'Project'} 
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Path" 
                  secondary={selectedNode.path} 
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Full Path" 
                  secondary={selectedNode.full_path} 
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Visibility" 
                  secondary={selectedNode.visibility || 'private'} 
                />
              </ListItem>
            </List>
          </Box>
        ) : (
          <Box 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              color: 'text.secondary',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Select a group or project
            </Typography>
            <Typography variant="body2">
              Click on an item in the tree to view details and actions
            </Typography>
          </Box>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <CreateProjectDialog
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onSuccess={() => {
          setCreateProjectOpen(false);
          setRefreshKey(prev => prev + 1);
        }}
        defaultGroup={getSelectedGroup()}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSuccess={() => {
          setCreateGroupOpen(false);
          setRefreshKey(prev => prev + 1);
        }}
        parentGroup={selectedNode?.type === 'group' ? {
          id: parseInt(selectedNode.id.replace('group-', '')),
          name: selectedNode.name,
        } : undefined}
      />
    </Box>
  );
};