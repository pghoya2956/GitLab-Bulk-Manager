import React, { useState } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view';
import { TreeItem } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CodeIcon from '@mui/icons-material/Code';
import { Box, Typography, Chip, CircularProgress, TextField, InputAdornment } from '@mui/material';
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
}

export const GitLabTree: React.FC<GitLabTreeProps> = ({
  onSelect,
  onDragStart,
  onDrop,
  selectedNodeId,
}) => {
  const [nodes, setNodes] = useState<{ [key: string]: TreeNode }>({});
  const [rootNodes, setRootNodes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const { showError } = useNotification();

  // Load root groups on mount
  React.useEffect(() => {
    loadRootNodes();
  }, []);

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

  const handleSelect = (event: React.SyntheticEvent | null, nodeIds: string[] | string) => {
    const nodeId = Array.isArray(nodeIds) ? nodeIds[0] : nodeIds;
    if (nodeId) {
      const node = nodes[nodeId];
      if (node) {
        onSelect(node);
      }
    }
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

  const renderTree = (nodeId: string): JSX.Element => {
    const node = nodes[nodeId];
    if (!node) return <></>;

    const isExpanded = expanded.includes(nodeId);
    const isDragOver = dragOverNodeId === nodeId;
    const isDropTarget = draggedNode && node.type === 'group' && draggedNode.id !== nodeId;

    return (
      <TreeItem
        key={nodeId}
        itemId={nodeId}
        label={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 0.5,
              pr: 0,
              borderRadius: 1,
              backgroundColor: isDragOver && isDropTarget ? 'action.hover' : 'transparent',
              border: isDragOver && isDropTarget ? '2px dashed' : '2px solid transparent',
              borderColor: isDragOver && isDropTarget ? 'primary.main' : 'transparent',
            }}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, node)}
            onDragOver={(e) => handleDragOver(e, nodeId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node)}
          >
            {node.type === 'group' ? (
              isExpanded ? <FolderOpenIcon sx={{ mr: 1 }} /> : <FolderIcon sx={{ mr: 1 }} />
            ) : (
              <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
            )}
            <Typography 
              variant="body2" 
              sx={{ 
                flexGrow: 1,
                fontWeight: selectedNodeId === nodeId ? 'bold' : 'normal',
              }}
            >
              {node.name}
            </Typography>
            {node.visibility && (
              <Chip label={node.visibility} size="small" sx={{ ml: 1 }} />
            )}
            {node.isLoading && (
              <CircularProgress size={16} sx={{ ml: 1 }} />
            )}
          </Box>
        }
      >
        {node.children ? node.children.map(childId => renderTree(childId)) : null}
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
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          expandedItems={expanded}
          selectedItems={selectedNodeId || ''}
          onExpandedItemsChange={handleToggle}
          onSelectedItemsChange={handleSelect}
          sx={{ flexGrow: 1, maxWidth: '100%' }}
        >
          {filteredRootNodes.map(nodeId => renderTree(nodeId))}
        </SimpleTreeView>
      </Box>
    </Box>
  );
};