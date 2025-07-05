import React, { useState, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Toolbar,
  Alert,
  Fade,
  ToggleButton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { gitlabService } from '../services/gitlab';
import { GitLabTree } from '../components/GitLabTree';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { ConfirmTransferDialog } from '../components/ConfirmTransferDialog';
import { ConfirmBulkTransferDialog } from '../components/ConfirmBulkTransferDialog';
import { useNotification } from '../hooks/useNotification';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

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

export const GroupsProjects: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useNotification();
  
  // State
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  
  // Multi-select state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [checkedNodes, setCheckedNodes] = useState<string[]>([]);
  const [nodeMap, setNodeMap] = useState<{ [key: string]: TreeNode }>({});
  
  // Drag and drop state
  const [pendingTransfer, setPendingTransfer] = useState<{
    source: TreeNode;
    target: TreeNode;
  } | null>(null);
  const [pendingBulkTransfer, setPendingBulkTransfer] = useState<{
    sources: TreeNode[];
    target: TreeNode;
  } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Handlers
  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    // Store node in map for later reference
    setNodeMap(prev => ({ ...prev, [node.id]: node }));
  };

  const handleDragDrop = useCallback((targetNode: TreeNode, draggedNode: TreeNode) => {
    // In multi-select mode with checked items, handle bulk transfer
    if (multiSelectMode && checkedNodes.length > 0) {
      const checkedNodeObjects = checkedNodes
        .map(id => nodeMap[id])
        .filter(Boolean);
      
      if (checkedNodeObjects.length > 0) {
        setPendingBulkTransfer({
          sources: checkedNodeObjects,
          target: targetNode,
        });
      }
    } else {
      // Show single item confirmation dialog
      setPendingTransfer({
        source: draggedNode,
        target: targetNode,
      });
    }
  }, [multiSelectMode, checkedNodes, nodeMap]);

  const handleConfirmTransfer = async () => {
    if (!pendingTransfer) return;
    
    const { source, target } = pendingTransfer;
    setTransferLoading(true);
    
    try {
      const targetGroupId = parseInt(target.id.replace('group-', ''));
      
      if (source.type === 'group') {
        const groupId = parseInt(source.id.replace('group-', ''));
        await gitlabService.transferGroup(groupId, targetGroupId);
        showSuccess(`Successfully moved ${source.name} to ${target.name}`);
      } else if (source.type === 'project') {
        const projectId = parseInt(source.id.replace('project-', ''));
        await gitlabService.transferProject(projectId, targetGroupId);
        showSuccess(`Successfully moved ${source.name} to ${target.name}`);
      }
      
      // Refresh tree
      setRefreshTrigger(prev => prev + 1);
      setPendingTransfer(null);
    } catch (error: any) {
      showError(error.response?.data?.message || `Failed to move ${source.name}`);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleConfirmBulkTransfer = async () => {
    if (!pendingBulkTransfer) return;
    
    const { sources, target } = pendingBulkTransfer;
    setTransferLoading(true);
    
    const targetGroupId = parseInt(target.id.replace('group-', ''));
    let successCount = 0;
    let failedItems: string[] = [];
    
    for (const source of sources) {
      try {
        if (source.type === 'group') {
          const groupId = parseInt(source.id.replace('group-', ''));
          await gitlabService.transferGroup(groupId, targetGroupId);
        } else if (source.type === 'project') {
          const projectId = parseInt(source.id.replace('project-', ''));
          await gitlabService.transferProject(projectId, targetGroupId);
        }
        successCount++;
      } catch (error: any) {
        failedItems.push(source.name);
      }
    }
    
    // Show results
    if (successCount > 0) {
      showSuccess(`Successfully moved ${successCount} items to ${target.name}`);
    }
    if (failedItems.length > 0) {
      showError(`Failed to move: ${failedItems.join(', ')}`);
    }
    
    // Clear selection and refresh
    setCheckedNodes([]);
    setRefreshTrigger(prev => prev + 1);
    setPendingBulkTransfer(null);
    setTransferLoading(false);
  };

  const handleCancelTransfer = () => {
    setPendingTransfer(null);
    setPendingBulkTransfer(null);
    setTransferLoading(false);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const toggleMultiSelectMode = () => {
    setMultiSelectMode(prev => !prev);
    setCheckedNodes([]); // Clear selection when toggling mode
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleAddMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleAddMenuClose = () => {
    setAddMenuAnchor(null);
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
      setRefreshTrigger(prev => prev + 1);
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
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Groups & Projects
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click groups to expand/collapse • Drag items to reorganize
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Multi-select Toggle */}
          <ToggleButton
            value="multiselect"
            selected={multiSelectMode}
            onChange={toggleMultiSelectMode}
            size="small"
            title={multiSelectMode ? "Disable multi-select" : "Enable multi-select"}
          >
            {multiSelectMode ? <CheckBoxIcon /> : <DragIndicatorIcon />}
          </ToggleButton>
          
          {/* Add Button with Menu */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddMenuOpen}
          >
            Add New
          </Button>
          
          <IconButton onClick={handleRefresh} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main Content */}
      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Bulk Actions Bar */}
        <Fade in={multiSelectMode && checkedNodes.length > 0}>
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider', 
            bgcolor: 'primary.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="body2" fontWeight="medium">
              {checkedNodes.length} item{checkedNodes.length > 1 ? 's' : ''} selected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCheckedNodes([])}
              >
                Clear Selection
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mx: 1 }}>
                Drag selected items to a group to move them
              </Typography>
            </Box>
          </Box>
        </Fade>

        {/* Selected Node Bar */}
        {selectedNode && !multiSelectMode && (
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider', 
            bgcolor: 'grey.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedNode.type === 'group' ? 
                <FolderIcon color="warning" /> : 
                <CodeIcon color="primary" />
              }
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {selectedNode.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedNode.full_path}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        )}

        {/* Tree View */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <GitLabTree
            refreshTrigger={refreshTrigger}
            onSelect={handleNodeSelect}
            onDrop={handleDragDrop}
            selectedNodeId={selectedNode?.id}
            checkedNodes={multiSelectMode ? checkedNodes : undefined}
            onCheckedNodesChange={multiSelectMode ? setCheckedNodes : undefined}
            expanded={expandedNodes}
            onExpandedChange={setExpandedNodes}
          />
        </Box>
      </Paper>

      {/* Add Menu */}
      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={handleAddMenuClose}
      >
        <MenuItem onClick={() => {
          setCreateGroupOpen(true);
          handleAddMenuClose();
        }}>
          Create New Group
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setCreateProjectOpen(true);
            handleAddMenuClose();
          }}
          disabled={!selectedNode || selectedNode.type !== 'group'}
        >
          Create New Project
          {(!selectedNode || selectedNode.type !== 'group') && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (Select a group first)
            </Typography>
          )}
        </MenuItem>
      </Menu>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose} disabled>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit (Coming soon)
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
          setRefreshTrigger(prev => prev + 1);
        }}
        defaultGroup={getSelectedGroup()}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onSuccess={() => {
          setCreateGroupOpen(false);
          setRefreshTrigger(prev => prev + 1);
        }}
        parentGroup={selectedNode?.type === 'group' ? {
          id: parseInt(selectedNode.id.replace('group-', '')),
          name: selectedNode.name,
        } : undefined}
      />

      <ConfirmTransferDialog
        open={Boolean(pendingTransfer)}
        onClose={handleCancelTransfer}
        onConfirm={handleConfirmTransfer}
        sourceNode={pendingTransfer?.source || null}
        targetNode={pendingTransfer?.target || null}
        loading={transferLoading}
      />

      <ConfirmBulkTransferDialog
        open={Boolean(pendingBulkTransfer)}
        onClose={handleCancelTransfer}
        onConfirm={handleConfirmBulkTransfer}
        sourceNodes={pendingBulkTransfer?.sources || []}
        targetNode={pendingBulkTransfer?.target || null}
        loading={transferLoading}
      />
    </Box>
  );
};