/**
 * GroupProjectTree Component
 * Displays GitLab groups and projects in a tree structure with selection and drag-drop capabilities
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Typography,
  Checkbox,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Search as SearchIcon, Folder, FolderOpen, Description } from '@mui/icons-material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useGitLabData } from '../../store/hooks';

interface SelectionItem {
  id: string;
  name: string;
  type: 'group' | 'project';
  path?: string;
  full_path?: string;
}

interface TreeNode {
  id: string;
  name: string;
  full_path: string;
  type: 'group' | 'project';
  children: TreeNode[];
}

interface GroupProjectTreeProps {
  selectedItems: SelectionItem[];
  onSelectionChange?: (items: SelectionItem[]) => void;
  onItemToggle?: (item: SelectionItem) => void;
  onDrop?: (targetGroup: SelectionItem, draggedItems: SelectionItem[]) => void;
}

export const GroupProjectTree: React.FC<GroupProjectTreeProps> = ({
  selectedItems,
  onItemToggle,
  onDrop,
}) => {
  const { groups, projects, loading, error } = useGitLabData();
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  // Build tree structure from groups and projects
  const buildTreeData = useCallback((): TreeNode[] => {
    if (!groups || !projects) return [];

    const treeData: TreeNode[] = [];
    const groupMap = new Map<number, TreeNode>();

    // First, create all groups
    groups.forEach(group => {
      const node: TreeNode = {
        id: `group-${group.id}`,
        name: group.name,
        full_path: group.full_path,
        type: 'group',
        children: [],
      };
      groupMap.set(group.id, node);

      if (!group.parent_id) {
        treeData.push(node);
      }
    });

    // Then, nest groups under their parents
    groups.forEach(group => {
      if (group.parent_id) {
        const parent = groupMap.get(group.parent_id);
        const child = groupMap.get(group.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    // Finally, add projects to their groups
    projects.forEach(project => {
      const projectNode: TreeNode = {
        id: `project-${project.id}`,
        name: project.name,
        full_path: project.path_with_namespace,
        type: 'project',
        children: [],
      };

      if (project.namespace?.id) {
        const group = groupMap.get(project.namespace.id);
        if (group) {
          group.children.push(projectNode);
        }
      } else {
        treeData.push(projectNode);
      }
    });

    return treeData;
  }, [groups, projects]);

  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) return nodes;

    return nodes.reduce((filtered: TreeNode[], node) => {
      const matchesSearch = node.name.toLowerCase().includes(term.toLowerCase()) ||
                           node.full_path?.toLowerCase().includes(term.toLowerCase());

      const filteredChildren = filterTree(node.children || [], term);

      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });
      }

      return filtered;
    }, []);
  };

  const treeData = filterTree(buildTreeData(), searchTerm);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    e.stopPropagation();
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
  };

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Only allow drop on groups
    if (nodeId.startsWith('group-')) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverNodeId(nodeId);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverNodeId(null);
  };

  const handleDrop = (e: React.DragEvent, targetNode: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeId(null);

    if (!onDrop) {
      setDraggedNode(null);
      return;
    }

    // Only allow drop on groups
    if (targetNode.type !== 'group') {
      setDraggedNode(null);
      return;
    }

    // Prepare items to transfer
    let itemsToTransfer: SelectionItem[] = [];

    if (draggedNode) {
      // Check if dragged node is in selected items
      const isDraggedNodeSelected = selectedItems.some(item => item.id === draggedNode.id);

      if (isDraggedNodeSelected && selectedItems.length > 1) {
        // Transfer all selected items
        itemsToTransfer = selectedItems.filter(item => item.id !== targetNode.id);
      } else {
        // Transfer only the dragged item
        itemsToTransfer = [{
          id: draggedNode.id,
          name: draggedNode.name,
          type: draggedNode.type,
          full_path: draggedNode.full_path,
        }];
      }
    }

    if (itemsToTransfer.length > 0) {
      const targetGroup: SelectionItem = {
        id: targetNode.id,
        name: targetNode.name,
        type: 'group',
        full_path: targetNode.full_path,
      };
      onDrop(targetGroup, itemsToTransfer);
    }

    setDraggedNode(null);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
    setDragOverNodeId(null);
  };

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map(node => {
      const isSelected = selectedItems.some(item => item.id === node.id);
      const isDragOver = dragOverNodeId === node.id;
      const isDragging = draggedNode?.id === node.id;

      return (
        <TreeItem
          key={node.id}
          itemId={node.id}
          label={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderRadius: 1,
                opacity: isDragging ? 0.5 : 1,
                backgroundColor: isSelected
                  ? 'action.selected'
                  : isDragOver
                  ? 'action.hover'
                  : 'transparent',
                border: isDragOver ? '2px dashed' : '2px solid transparent',
                borderColor: isDragOver ? 'primary.main' : 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: isSelected ? 'action.selected' : 'action.hover',
                },
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, node)}
              onDragOver={(e) => handleDragOver(e, node.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, node)}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                // 체크박스 클릭 시 이벤트 중복 방지
                if ((e.target as HTMLElement).closest('.MuiCheckbox-root')) {
                  return;
                }
                e.stopPropagation();
                if (onItemToggle) {
                  onItemToggle({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    full_path: node.full_path,
                  });
                }
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onItemToggle) {
                    onItemToggle({
                      id: node.id,
                      name: node.name,
                      type: node.type,
                      full_path: node.full_path,
                    });
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                size="small"
              />
              {node.type === 'group' ? (
                expanded.includes(node.id) ? <FolderOpen color={isDragOver ? 'primary' : 'inherit'} /> : <Folder color={isDragOver ? 'primary' : 'inherit'} />
              ) : (
                <Description />
              )}
              <Typography sx={{ ml: 1 }}>{node.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {node.full_path}
              </Typography>
            </Box>
          }
        >
          {node.children && node.children.length > 0 && renderTree(node.children)}
        </TreeItem>
      );
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load GitLab data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search groups and projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {treeData.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No groups or projects found
          </Typography>
        ) : (
          <SimpleTreeView
            expandedItems={expanded}
            onExpandedItemsChange={(_event, nodeIds) => setExpanded(nodeIds as string[])}
          >
            {renderTree(treeData)}
          </SimpleTreeView>
        )}
      </Box>
    </Box>
  );
};

export default GroupProjectTree;
