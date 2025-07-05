import React, { useState, useEffect } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view';
import { TreeItem } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CodeIcon from '@mui/icons-material/Code';
import { Box, Typography, Chip, CircularProgress, TextField, InputAdornment, Checkbox } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { gitlabService } from '../services/gitlab';
import { useNotification } from '../hooks/useNotification';

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
  children?: string[]; // Changed to string[] to store child IDs
  hasChildren?: boolean;
  isLoading?: boolean;
}

interface GitLabTreeProps {
  onSelect: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode) => void;
  onDrop?: (targetNode: TreeNode, draggedNode: TreeNode) => void;
  selectedNodeId?: string;
  checkedNodes?: string[];
  onCheckedNodesChange?: (nodeIds: string[]) => void;
  expanded?: string[];
  onExpandedChange?: (nodeIds: string[]) => void;
  refreshTrigger?: number;
}

export const GitLabTree: React.FC<GitLabTreeProps> = ({
  onSelect,
  onDragStart,
  onDrop,
  selectedNodeId,
  checkedNodes = [],
  onCheckedNodesChange,
  expanded: controlledExpanded,
  onExpandedChange,
  refreshTrigger,
}) => {
  const [nodes, setNodes] = useState<{ [key: string]: TreeNode }>({});
  const [rootNodes, setRootNodes] = useState<string[]>([]);
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const { showError } = useNotification();

  // Use controlled expanded state if provided, otherwise use internal state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = (nodeIds: string[]) => {
    if (onExpandedChange) {
      onExpandedChange(nodeIds);
    } else {
      setInternalExpanded(nodeIds);
    }
  };

  // Load root groups on mount and when refresh triggered
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      // Partial refresh: reload expanded nodes' children
      const reloadExpandedNodes = async () => {
        for (const nodeId of expanded) {
          const node = nodes[nodeId];
          if (node && node.type === 'group') {
            // Clear children to force reload
            setNodes(prev => ({
              ...prev,
              [nodeId]: { ...prev[nodeId], children: undefined }
            }));
            await loadChildren(nodeId);
          }
        }
      };
      reloadExpandedNodes();
    } else {
      loadRootNodes();
    }
  }, [refreshTrigger]);

  const loadRootNodes = async () => {
    try {
      setLoading(true);
      const groups = await gitlabService.getGroups({ 
        per_page: 100,
        top_level_only: true 
      });
      
      const nodeMap: { [key: string]: TreeNode } = {};
      const rootIds: string[] = [];
      
      groups.forEach((group: any) => {
        const nodeId = `group-${group.id}`;
        nodeMap[nodeId] = {
          id: nodeId,
          name: group.name,
          type: 'group',
          path: group.path,
          full_path: group.full_path,
          visibility: group.visibility,
          description: group.description,
          parent_id: group.parent_id,
          hasChildren: true, // Assume groups can have children
        };
        if (!group.parent_id) {
          rootIds.push(nodeId);
        }
      });
      
      setNodes(nodeMap);
      setRootNodes(rootIds);
    } catch (error: any) {
      if (error.response?.status === 401) {
        showError('Please login to view groups and projects');
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        showError(error.response?.data?.message || 'Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async (nodeId: string) => {
    const node = nodes[nodeId];
    if (!node || node.children || node.isLoading) return;

    try {
      // Mark as loading
      setNodes(prev => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], isLoading: true }
      }));

      const groupId = parseInt(nodeId.replace('group-', ''));
      
      // Load subgroups and projects in parallel
      const [subgroups, projects] = await Promise.all([
        gitlabService.getGroups({ parent_id: groupId, per_page: 100 }),
        gitlabService.getGroupProjects(groupId)
      ]);

      const newNodes: { [key: string]: TreeNode } = {};
      const childIds: string[] = [];

      // Process subgroups
      subgroups.forEach((group: any) => {
        const childId = `group-${group.id}`;
        newNodes[childId] = {
          id: childId,
          name: group.name,
          type: 'group',
          path: group.path,
          full_path: group.full_path,
          visibility: group.visibility,
          description: group.description,
          parent_id: group.parent_id,
          hasChildren: true,
        };
        childIds.push(childId);
      });

      // Process projects
      projects.forEach((project: any) => {
        const childId = `project-${project.id}`;
        newNodes[childId] = {
          id: childId,
          name: project.name,
          type: 'project',
          path: project.path,
          full_path: project.path_with_namespace,
          visibility: project.visibility,
          description: project.description,
          namespace: project.namespace,
          hasChildren: false,
        };
        childIds.push(childId);
      });

      // Update nodes
      setNodes(prev => ({
        ...prev,
        ...newNodes,
        [nodeId]: {
          ...prev[nodeId],
          children: childIds,
          isLoading: false,
        }
      }));
    } catch (error) {
      showError('Failed to load children');
      setNodes(prev => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], isLoading: false }
      }));
    }
  };

  const handleToggle = (event: React.SyntheticEvent | null, nodeIds: string[]) => {
    setExpanded(nodeIds);
    
    // Load children for newly expanded nodes
    nodeIds.forEach(nodeId => {
      if (!expanded.includes(nodeId)) {
        loadChildren(nodeId);
      }
    });
  };

  const handleNodeClick = (event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    const node = nodes[nodeId];
    if (!node) return;

    // For groups, toggle expansion on click
    if (node.type === 'group') {
      const newExpanded = expanded.includes(nodeId)
        ? expanded.filter(id => id !== nodeId)
        : [...expanded, nodeId];
      
      setExpanded(newExpanded);
      
      // Load children if expanding
      if (!expanded.includes(nodeId)) {
        loadChildren(nodeId);
      }
    }
    
    // Always select the node
    onSelect(node);
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>, nodeId: string) => {
    event.stopPropagation();
    if (!onCheckedNodesChange) return;

    const isChecked = event.target.checked;
    let newCheckedNodes: string[];

    if (isChecked) {
      newCheckedNodes = [...checkedNodes, nodeId];
    } else {
      newCheckedNodes = checkedNodes.filter(id => id !== nodeId);
    }

    onCheckedNodesChange(newCheckedNodes);
  };

  const handleSelect = (event: React.SyntheticEvent | null, nodeIds: string[] | string) => {
    // This is now handled by handleNodeClick
  };

  const handleDragStart = (event: React.DragEvent, node: TreeNode) => {
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNode(node);
    if (onDragStart) {
      onDragStart(node);
    }
  };

  const handleDragOver = (event: React.DragEvent, nodeId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverNodeId(nodeId);
  };

  const handleDragLeave = () => {
    setDragOverNodeId(null);
  };

  const handleDrop = (event: React.DragEvent, targetNode: TreeNode) => {
    event.preventDefault();
    setDragOverNodeId(null);
    
    if (draggedNode && onDrop && draggedNode.id !== targetNode.id) {
      // Validate drop
      if (targetNode.type === 'project') {
        showError('Cannot drop items into projects');
        return;
      }
      
      onDrop(targetNode, draggedNode);
    }
    setDraggedNode(null);
  };

  const renderTree = (nodeId: string, depth: number = 0): JSX.Element => {
    const node = nodes[nodeId];
    if (!node) return <></>;

    const isExpanded = expanded.includes(nodeId);
    const isDragOver = dragOverNodeId === nodeId;
    const isDropTarget = draggedNode && node.type === 'group' && draggedNode.id !== nodeId;
    const hasChildren = node.hasChildren || (node.children && node.children.length > 0);

    return (
      <TreeItem
        key={nodeId}
        itemId={nodeId}
        label={
          <Box
            onClick={(e) => handleNodeClick(e, nodeId)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 0.5,
              pr: 1,
              borderRadius: 1,
              backgroundColor: isDragOver && isDropTarget ? 'action.hover' : 
                              selectedNodeId === nodeId ? 'action.selected' : 'transparent',
              border: isDragOver && isDropTarget ? '2px dashed' : '2px solid transparent',
              borderColor: isDragOver && isDropTarget ? 'primary.main' : 'transparent',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              ml: depth * 2, // Increased indentation for better hierarchy
            }}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, node)}
            onDragOver={(e) => handleDragOver(e, nodeId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node)}
          >
            {/* Checkbox for multi-select */}
            {onCheckedNodesChange && (
              <Checkbox
                size="small"
                checked={checkedNodes.includes(nodeId)}
                onChange={(e) => handleCheckboxChange(e, nodeId)}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0.5, mr: 0.5 }}
              />
            )}

            {/* Expand/Collapse Icon for Groups */}
            {node.type === 'group' && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
                {hasChildren ? (
                  isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />
                ) : (
                  <Box sx={{ width: 20 }} /> // Spacer for alignment
                )}
              </Box>
            )}
            
            {/* Folder/Project Icon */}
            {node.type === 'group' ? (
              isExpanded ? <FolderOpenIcon sx={{ mr: 1, color: 'warning.main' }} /> : <FolderIcon sx={{ mr: 1, color: 'warning.main' }} />
            ) : (
              <CodeIcon sx={{ mr: 1, color: 'primary.main', ml: node.type === 'project' ? 2.5 : 0 }} />
            )}
            
            {/* Node Name */}
            <Typography 
              variant="body2" 
              sx={{ 
                flexGrow: 1,
                fontWeight: selectedNodeId === nodeId ? 'bold' : 'normal',
                userSelect: 'none',
              }}
            >
              {node.name}
            </Typography>
            
            {/* Children Count for Groups */}
            {node.type === 'group' && node.children && node.children.length > 0 && (
              <Chip 
                label={node.children.length} 
                size="small" 
                sx={{ 
                  ml: 1, 
                  height: 20,
                  minWidth: 28,
                  '& .MuiChip-label': { px: 1 }
                }} 
              />
            )}
            
            {/* Visibility Badge */}
            {node.visibility && node.visibility !== 'private' && (
              <Chip 
                label={node.visibility} 
                size="small" 
                variant="outlined"
                sx={{ ml: 1, height: 20 }} 
              />
            )}
            
            {/* Loading Indicator */}
            {node.isLoading && (
              <CircularProgress size={16} sx={{ ml: 1 }} />
            )}
          </Box>
        }
      >
        {node.children && isExpanded ? node.children.map(childId => renderTree(childId, depth + 1)) : null}
      </TreeItem>
    );
  };

  const filteredRootNodes = searchQuery
    ? rootNodes.filter(nodeId => {
        const node = nodes[nodeId];
        return node && node.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : rootNodes;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search groups and projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <SimpleTreeView
          expandedItems={expanded}
          selectedItems={selectedNodeId || ''}
          onExpandedItemsChange={handleToggle}
          onSelectedItemsChange={handleSelect}
          sx={{ 
            flexGrow: 1, 
            maxWidth: '100%',
            '& .MuiTreeItem-content': {
              padding: 0,
            },
            '& .MuiTreeItem-iconContainer': {
              display: 'none', // Hide default expand icons as we're using custom ones
            },
          }}
        >
          {filteredRootNodes.map(nodeId => renderTree(nodeId))}
        </SimpleTreeView>
      </Box>
    </Box>
  );
};