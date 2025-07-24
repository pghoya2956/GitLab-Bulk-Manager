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
import GroupIcon from '@mui/icons-material/Group';
import ShieldIcon from '@mui/icons-material/Shield';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import BusinessIcon from '@mui/icons-material/Business';
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
  namespace?: {
    id: number;
    name: string;
    path: string;
    kind: string;
    full_path: string;
  };
  children?: string[]; // Changed to string[] to store child IDs
  hasChildren?: boolean;
  isLoading?: boolean;
  // Permission fields
  memberCount?: number;
  userAccess?: {
    access_level: number;
    access_level_name: string;
  };
}

interface GitLabTreeProps {
  onSelect: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode) => void;
  onDrop?: (targetNode: TreeNode, draggedNode: TreeNode) => void;
  selectedNodeId?: string;
  checkedNodes?: string[];
  onCheckedNodesChange?: (nodeIds: string[], nodes?: TreeNode[]) => void;
  expanded?: string[];
  onExpandedChange?: (nodeIds: string[]) => void;
  refreshTrigger?: number;
  showOnlyDeveloperPlus?: boolean;
  showPermissions?: boolean;
}

// Helper function to get access level color
const getAccessLevelColor = (level: string): string => {
  switch (level?.toLowerCase()) {
    case 'owner':
      return '#d32f2f'; // Stronger red
    case 'maintainer':
      return '#1976d2'; // Stronger blue
    case 'developer':
      return '#388e3c'; // Stronger green
    case 'reporter':
      return '#f57c00'; // Orange for better visibility
    case 'guest':
      return '#616161'; // Darker gray
    default:
      return '#9e9e9e';
  }
};

// Helper function to get visibility icon
const getVisibilityIcon = (visibility: string) => {
  switch (visibility) {
    case 'public':
      return <PublicIcon sx={{ fontSize: 16 }} />;
    case 'private':
      return <LockIcon sx={{ fontSize: 16 }} />;
    case 'internal':
      return <BusinessIcon sx={{ fontSize: 16 }} />;
    default:
      return null;
  }
};

// Helper function to get visibility color
const getVisibilityColor = (visibility: string): { bgcolor: string, color: string } => {
  switch (visibility) {
    case 'public':
      return { bgcolor: '#e8f5e9', color: '#2e7d32' };
    case 'private':
      return { bgcolor: '#fce4ec', color: '#c2185b' };
    case 'internal':
      return { bgcolor: '#fff3e0', color: '#f57c00' };
    default:
      return { bgcolor: '#f5f5f5', color: '#616161' };
  }
};

// Helper function to check if access level is Developer+
const isHighLevelAccess = (level: string): boolean => {
  return ['owner', 'maintainer', 'developer'].includes(level?.toLowerCase() || '');
};

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
  showOnlyDeveloperPlus = false,
  showPermissions = true,
}) => {
  const [nodes, setNodes] = useState<{ [key: string]: TreeNode }>({});
  const [rootNodes, setRootNodes] = useState<string[]>([]);
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [permissionsData, setPermissionsData] = useState<any>(null);
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

  // Load permissions data when showPermissions is enabled
  useEffect(() => {
    if (showPermissions) {
      loadPermissions();
    }
  }, [showPermissions]);

  const loadPermissions = async () => {
    try {
      const data = await gitlabService.getPermissionsOverview();
      setPermissionsData(data);
    } catch (error) {
      // Silently fail - permissions are optional enhancement
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
      // Also reload permissions
      if (showPermissions) {
        loadPermissions();
      }
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
      
      // Note: Groups don't have an archived property in GitLab API
      // Only projects can be archived
      
      groups.forEach((group: any) => {
        
        const nodeId = `group-${group.id}`;
        
        // Find permission data for this group
        let permissionInfo = null;
        if (permissionsData?.groups) {
          const findGroupPermission = (groups: any[]): any => {
            for (const g of groups) {
              if (g.id === group.id) {return g;}
              if (g.subgroups) {
                const found = findGroupPermission(g.subgroups);
                if (found) {return found;}
              }
            }
            return null;
          };
          permissionInfo = findGroupPermission(permissionsData.groups);
        }
        
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
          memberCount: permissionInfo?.member_count,
          userAccess: permissionInfo?.user_access,
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
    if (!node || node.children || node.isLoading) {return;}

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

      // Note: Groups don't have an archived property in GitLab API
      // Only projects can be archived
      
      // Process subgroups
      subgroups.forEach((group: any) => {
        
        const childId = `group-${group.id}`;
        
        // Find permission data for this subgroup
        let permissionInfo = null;
        if (permissionsData?.groups) {
          const findGroupPermission = (groups: any[]): any => {
            for (const g of groups) {
              if (g.id === group.id) {return g;}
              if (g.subgroups) {
                const found = findGroupPermission(g.subgroups);
                if (found) {return found;}
              }
            }
            return null;
          };
          permissionInfo = findGroupPermission(permissionsData.groups);
        }
        
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
          memberCount: permissionInfo?.member_count,
          userAccess: permissionInfo?.user_access,
        };
        childIds.push(childId);
      });

      // Filter out archived projects first
      const activeProjects = projects.filter((project: any) => !project.archived);
      console.log(`Filtered ${projects.length - activeProjects.length} archived projects from ${projects.length} total projects`);
      
      // Process projects
      activeProjects.forEach((project: any) => {
        
        const childId = `project-${project.id}`;
        
        // Find permission data for this project
        let permissionInfo = null;
        if (permissionsData?.groups) {
          const findProjectPermission = (groups: any[]): any => {
            for (const g of groups) {
              if (g.projects) {
                const proj = g.projects.find((p: any) => p.id === project.id);
                if (proj) {return proj;}
              }
              if (g.subgroups) {
                const found = findProjectPermission(g.subgroups);
                if (found) {return found;}
              }
            }
            return null;
          };
          permissionInfo = findProjectPermission(permissionsData.groups);
        }
        
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
          memberCount: permissionInfo?.member_count,
          userAccess: permissionInfo?.user_access,
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

  const handleToggle = (_event: React.SyntheticEvent | null, nodeIds: string[]) => {
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
    if (!node) {return;}

    // Always select the node first
    onSelect(node);
    
    // For groups, toggle expansion on click
    if (node.type === 'group') {
      const isCurrentlyExpanded = expanded.includes(nodeId);
      const newExpanded = isCurrentlyExpanded
        ? expanded.filter(id => id !== nodeId)
        : [...expanded, nodeId];
      
      setExpanded(newExpanded);
      
      // Load children if expanding and not already loaded
      if (!isCurrentlyExpanded && !node.children) {
        loadChildren(nodeId);
      }
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>, nodeId: string) => {
    event.stopPropagation();
    if (!onCheckedNodesChange) {return;}

    const isChecked = event.target.checked;
    let newCheckedNodes: string[];

    if (isChecked) {
      newCheckedNodes = [...checkedNodes, nodeId];
    } else {
      newCheckedNodes = checkedNodes.filter(id => id !== nodeId);
    }

    // Pass node information along with IDs
    const checkedNodeObjects = newCheckedNodes.map(id => nodes[id]).filter(Boolean);
    onCheckedNodesChange(newCheckedNodes, checkedNodeObjects);
  };

  const handleSelect = (_event: React.SyntheticEvent | null, _nodeIds: string[] | string) => {
    // This is now handled by handleNodeClick
  };

  const handleDragStart = (event: React.DragEvent, node: TreeNode) => {
    event.dataTransfer.effectAllowed = 'move';
    
    // If we're in multi-select mode
    if (onCheckedNodesChange) {
      // If dragging a checked item, move all checked items
      if (checkedNodes.includes(node.id)) {
        event.dataTransfer.setData('text/plain', `Moving ${checkedNodes.length} items`);
        setDraggedNode({
          ...node,
          name: `${checkedNodes.length} selected items`,
        });
      } else {
        // If dragging an unchecked item in multi-select mode, just move that single item
        setDraggedNode(node);
      }
    } else {
      // Single item drag (no multi-select mode)
      setDraggedNode(node);
    }
    
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
        setDraggedNode(null);
        return;
      }
      
      // Check if we're dropping multiple selected items
      if (onCheckedNodesChange && checkedNodes.length > 0 && checkedNodes.some(id => id === draggedNode.id || draggedNode.name.includes('selected items'))) {
        // This will trigger bulk transfer in the parent component
        onDrop(targetNode, draggedNode);
      } else {
        // Single item drop
        onDrop(targetNode, draggedNode);
      }
    }
    setDraggedNode(null);
  };

  const renderTree = (nodeId: string, depth: number = 0): JSX.Element => {
    const node = nodes[nodeId];
    if (!node) {return <></>;}

    // Filter based on access level if showOnlyDeveloperPlus is enabled
    if (showOnlyDeveloperPlus && node.userAccess && !isHighLevelAccess(node.userAccess.access_level_name)) {
      return <></>;
    }

    const isExpanded = expanded.includes(nodeId);
    const isDragOver = dragOverNodeId === nodeId;
    const isDropTarget = draggedNode && node.type === 'group' && draggedNode.id !== nodeId;
    const hasChildren = node.type === 'group' && (node.hasChildren || (node.children && node.children.length > 0));

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
            
            {/* Tags Container */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', ml: 1 }}>
              {/* Member Count */}
              {showPermissions && node.memberCount !== undefined && (
                <Chip 
                  icon={<GroupIcon />}
                  label={`${node.memberCount} ${node.memberCount === 1 ? 'member' : 'members'}`}
                  size="small"
                  sx={{ 
                    height: 24,
                    bgcolor: '#e3f2fd',
                    color: '#1565c0',
                    '& .MuiChip-icon': {
                      fontSize: 16,
                      color: '#1565c0',
                    },
                    '&:hover': {
                      bgcolor: '#bbdefb',
                      boxShadow: 1,
                    },
                  }} 
                />
              )}
              
              {/* Access Level */}
              {showPermissions && node.userAccess && (
                <Chip 
                  icon={<ShieldIcon />}
                  label={node.userAccess.access_level_name}
                  size="small"
                  sx={{ 
                    height: 24,
                    bgcolor: getAccessLevelColor(node.userAccess.access_level_name),
                    color: 'white',
                    fontWeight: 500,
                    '& .MuiChip-icon': {
                      fontSize: 16,
                      color: 'white',
                    },
                    '&:hover': {
                      filter: 'brightness(0.9)',
                      boxShadow: 1,
                    },
                  }} 
                />
              )}
              
              {/* Visibility Badge */}
              {node.visibility && (
                <Chip 
                  icon={getVisibilityIcon(node.visibility) || undefined}
                  label={node.visibility} 
                  size="small" 
                  sx={{ 
                    height: 24,
                    ...getVisibilityColor(node.visibility),
                    fontWeight: 500,
                    '& .MuiChip-icon': {
                      fontSize: 16,
                    },
                    '&:hover': {
                      filter: 'brightness(0.95)',
                      boxShadow: 1,
                    },
                  }} 
                />
              )}
            </Box>
            
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
          onSelectedItemsChange={(event, itemIds) => handleSelect(event, itemIds || '')}
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