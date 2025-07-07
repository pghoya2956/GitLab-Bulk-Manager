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
  Fade,
  ToggleButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
// import { useTranslation } from 'react-i18next';
import { gitlabService } from '../services/gitlab';
import { GitLabTree } from '../components/GitLabTree';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { ConfirmTransferDialog } from '../components/ConfirmTransferDialog';
import { ConfirmBulkTransferDialog } from '../components/ConfirmBulkTransferDialog';
import { BulkImportDialog } from '../components/bulk/BulkImportDialog';
import { BulkSettingsDialog } from '../components/bulk/BulkSettingsDialog';
import SvnMigrationDialog from '../components/svn/SvnMigrationDialog';
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
import SettingsIcon from '@mui/icons-material/Settings';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import UploadIcon from '@mui/icons-material/Upload';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

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
  // const { t } = useTranslation();
  const { showSuccess, showError } = useNotification();
  
  // State
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [showOnlyDeveloperPlus, setShowOnlyDeveloperPlus] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkSettingsOpen, setBulkSettingsOpen] = useState(false);
  const [svnMigrationOpen, setSvnMigrationOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
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
    // Check if this is a bulk drag operation
    if (multiSelectMode && checkedNodes.length > 0 && 
        (checkedNodes.includes(draggedNode.id) || draggedNode.name.includes('selected items'))) {
      const checkedNodeObjects = checkedNodes
        .map(id => nodeMap[id])
        .filter(Boolean);
      
      // Ensure we don't include the target in the sources
      const validSources = checkedNodeObjects.filter(node => node.id !== targetNode.id);
      
      if (validSources.length > 0) {
        setPendingBulkTransfer({
          sources: validSources,
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
    if (!pendingTransfer) {return;}
    
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
    } catch (error) {
      showError((error as any).response?.data?.message || `Failed to move ${source.name}`);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleConfirmBulkTransfer = async () => {
    if (!pendingBulkTransfer) {return;}
    
    const { sources, target } = pendingBulkTransfer;
    setTransferLoading(true);
    
    const targetGroupId = parseInt(target.id.replace('group-', ''));
    let successCount = 0;
    const failedItems: string[] = [];
    
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
      } catch (error) {
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
    if (!selectedNode) {return;}
    
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
    } catch (error) {
      showError((error as any).response?.data?.message || 'Failed to delete');
    }
    
    handleMenuClose();
  };

  const handleBulkDelete = async () => {
    const selectedItems = checkedNodes
      .map(id => nodeMap[id])
      .filter(Boolean);

    if (selectedItems.length === 0) {return;}

    const confirmMessage = `Are you sure you want to delete ${selectedItems.length} items? This action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await gitlabService.bulkDelete(items);
      
      if (response.results?.successful && response.results.successful.length > 0) {
        showSuccess(`Successfully deleted ${response.results.successful.length} items`);
      }
      if (response.results?.failed && response.results.failed.length > 0) {
        showError(`Failed to delete ${response.results.failed.length} items`);
      }
      
      setCheckedNodes([]);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      showError((error as any).response?.data?.message || 'Failed to delete items');
    }
    
    setBulkMenuAnchor(null);
  };

  const handleBulkMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setBulkMenuAnchor(event.currentTarget);
  };

  const handleBulkMenuClose = () => {
    setBulkMenuAnchor(null);
  };

  const getSelectedGroup = () => {
    if (!selectedNode) {return undefined;}
    
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
      <Box sx={{ mb: 3 }}>
        {/* Title and Controls Row */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
              Groups & Projects
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click groups to expand/collapse • Drag items to reorganize • {showOnlyDeveloperPlus ? 'Showing Developer+ only' : 'Showing all access levels'}
            </Typography>
          </Box>
          
          {/* Top Right Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyDeveloperPlus}
                  onChange={(e) => setShowOnlyDeveloperPlus(e.target.checked)}
                  size="small"
                />
              }
              label={showOnlyDeveloperPlus ? "Developer+ only" : "All access levels"}
              sx={{ m: 0 }}
            />
            
            <ToggleButton
              value="multiselect"
              selected={multiSelectMode}
              onChange={toggleMultiSelectMode}
              size="small"
              title={multiSelectMode ? "Disable multi-select" : "Enable multi-select"}
              sx={{
                px: 1.5,
                py: 0.5,
                border: '1px solid',
                borderColor: multiSelectMode ? 'primary.main' : 'divider',
                backgroundColor: multiSelectMode ? 'primary.50' : 'transparent',
              }}
            >
              {multiSelectMode ? <CheckBoxIcon fontSize="small" /> : <DragIndicatorIcon fontSize="small" />}
            </ToggleButton>
            
            <IconButton onClick={handleRefresh} title="Refresh" size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Action Buttons Row */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2,
            backgroundColor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.100',
            borderRadius: 2,
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <RocketLaunchIcon sx={{ color: 'primary.main', mr: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', mr: 2 }}>
            Quick Actions
          </Typography>
          
          <Divider orientation="vertical" flexItem sx={{ mr: 2 }} />
          
          {/* SVN Migration Button */}
          <Button
            variant="contained"
            size="large"
            startIcon={<CompareArrowsIcon />}
            onClick={() => setSvnMigrationOpen(true)}
            sx={{ 
              minWidth: 150,
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
              },
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 10px rgba(102, 126, 234, 0.3)',
            }}
          >
            SVN to Git
          </Button>
          
          {/* Bulk Import Button */}
          <Button
            variant="contained"
            size="large"
            startIcon={<UploadIcon />}
            onClick={() => setBulkImportOpen(true)}
            sx={{ 
              minWidth: 150,
              py: 1.5,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(79, 172, 254, 0.4)',
              },
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 10px rgba(79, 172, 254, 0.3)',
            }}
          >
            Bulk Import
          </Button>
          
          {/* Add Button with Menu */}
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleAddMenuOpen}
            sx={{ 
              minWidth: 130,
              py: 1.5,
              background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
              color: 'rgba(0, 0, 0, 0.87)',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #8fd3f4 0%, #84fab0 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(132, 250, 176, 0.4)',
              },
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 10px rgba(132, 250, 176, 0.3)',
            }}
          >
            Add New
          </Button>
        </Paper>
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
              
              {/* Bulk Actions Menu */}
              <Button
                size="small"
                variant="outlined"
                startIcon={<MoreVertIcon />}
                onClick={handleBulkMenuOpen}
              >
                Bulk Actions
              </Button>
              
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mx: 1 }}>
                Drag to move • Use bulk actions for settings
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

        {/* Tree View with integrated permissions */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <GitLabTree
            refreshTrigger={refreshTrigger}
            onSelect={handleNodeSelect}
            onDrop={handleDragDrop}
            selectedNodeId={selectedNode?.id}
            checkedNodes={multiSelectMode ? checkedNodes : undefined}
            onCheckedNodesChange={multiSelectMode ? (ids: string[], nodes?: TreeNode[]) => {
              setCheckedNodes(ids);
              if (nodes) {
                const newNodeMap: { [key: string]: TreeNode } = {};
                nodes.forEach(node => {
                  newNodeMap[node.id] = node;
                });
                setNodeMap(prev => ({ ...prev, ...newNodeMap }));
              }
            } : undefined}
            expanded={expandedNodes}
            onExpandedChange={setExpandedNodes}
            showOnlyDeveloperPlus={showOnlyDeveloperPlus}
            showPermissions={true}
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

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkMenuAnchor}
        open={Boolean(bulkMenuAnchor)}
        onClose={handleBulkMenuClose}
      >
        <MenuItem 
          onClick={() => {
            setBulkSettingsOpen(true);
            handleBulkMenuClose();
          }}
        >
          <SettingsIcon sx={{ mr: 1 }} fontSize="small" />
          Bulk Settings
        </MenuItem>
        <MenuItem 
          onClick={() => {
            handleBulkMenuClose();
            // Trigger drag mode - items are already selected
          }}
        >
          <DriveFileMoveIcon sx={{ mr: 1 }} fontSize="small" />
          Move Selected Items
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={handleBulkDelete}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete Selected Items
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

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        selectedGroup={selectedNode?.type === 'group' ? {
          id: selectedNode.id,
          name: selectedNode.name,
          full_path: selectedNode.full_path,
        } : undefined}
        onSuccess={() => {
          setBulkImportOpen(false);
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      <BulkSettingsDialog
        open={bulkSettingsOpen}
        onClose={() => setBulkSettingsOpen(false)}
        selectedItems={checkedNodes
          .map(id => nodeMap[id])
          .filter(Boolean)
          .map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            full_path: node.full_path,
          }))}
        onSuccess={() => {
          setBulkSettingsOpen(false);
          setCheckedNodes([]);
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      <SvnMigrationDialog
        open={svnMigrationOpen}
        onClose={() => setSvnMigrationOpen(false)}
        selectedGroup={selectedNode?.type === 'group' ? {
          id: parseInt(selectedNode.id.replace('group-', '')),
          name: selectedNode.name,
          full_path: selectedNode.full_path,
        } : undefined}
        onSuccess={() => {
          setSvnMigrationOpen(false);
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </Box>
  );
};