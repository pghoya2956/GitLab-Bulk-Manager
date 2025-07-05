import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';

interface HierarchyNode {
  id: string;
  name: string;
  path: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  settings?: Record<string, any>;
  subgroups?: HierarchyNode[];
}

interface HierarchyBuilderProps {
  parentId: number;
  onGenerate: (data: any) => void;
}

export const HierarchyBuilder: React.FC<HierarchyBuilderProps> = ({ parentId, onGenerate }) => {
  const [nodes, setNodes] = useState<HierarchyNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [defaults, setDefaults] = useState({
    visibility: 'private' as const,
    request_access_enabled: true,
    project_creation_level: 'developer',
    subgroup_creation_level: 'maintainer'
  });

  // 노드 추가
  const addNode = (parentNodes: HierarchyNode[] = nodes, parentId?: string) => {
    const newNode: HierarchyNode = {
      id: Date.now().toString(),
      name: '',
      path: '',
      visibility: defaults.visibility,
      subgroups: []
    };

    if (parentId) {
      const updateNodes = (nodes: HierarchyNode[]): HierarchyNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            return {
              ...node,
              subgroups: [...(node.subgroups || []), newNode]
            };
          }
          if (node.subgroups) {
            return {
              ...node,
              subgroups: updateNodes(node.subgroups)
            };
          }
          return node;
        });
      };
      setNodes(updateNodes(nodes));
    } else {
      setNodes([...nodes, newNode]);
    }
  };

  // 노드 업데이트
  const updateNode = (nodeId: string, updates: Partial<HierarchyNode>) => {
    const updateNodes = (nodes: HierarchyNode[]): HierarchyNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, ...updates };
        }
        if (node.subgroups) {
          return {
            ...node,
            subgroups: updateNodes(node.subgroups)
          };
        }
        return node;
      });
    };
    setNodes(updateNodes(nodes));
  };

  // 노드 삭제
  const deleteNode = (nodeId: string) => {
    const deleteFromNodes = (nodes: HierarchyNode[]): HierarchyNode[] => {
      return nodes
        .filter(node => node.id !== nodeId)
        .map(node => {
          if (node.subgroups) {
            return {
              ...node,
              subgroups: deleteFromNodes(node.subgroups)
            };
          }
          return node;
        });
    };
    setNodes(deleteFromNodes(nodes));
  };

  // YAML 생성
  const generateYaml = () => {
    const cleanNode = (node: HierarchyNode): any => {
      const cleaned: any = {
        name: node.name,
        path: node.path,
        description: node.description || undefined,
        visibility: node.visibility !== defaults.visibility ? node.visibility : undefined
      };

      if (node.settings && Object.keys(node.settings).length > 0) {
        cleaned.settings = node.settings;
      }

      if (node.subgroups && node.subgroups.length > 0) {
        cleaned.subgroups = node.subgroups.map(cleanNode);
      }

      // undefined 값 제거
      Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined) {
          delete cleaned[key];
        }
      });

      return cleaned;
    };

    const yamlData = {
      parent_id: parentId,
      defaults,
      subgroups: nodes.map(cleanNode)
    };

    onGenerate(yamlData);
  };

  // 노드 렌더링
  const renderNode = (node: HierarchyNode, level: number = 0): React.ReactNode => {
    const isExpanded = expanded[node.id] ?? true;

    return (
      <Box key={node.id} sx={{ ml: level * 4 }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {node.subgroups && node.subgroups.length > 0 && (
              <IconButton
                size="small"
                onClick={() => setExpanded({ ...expanded, [node.id]: !isExpanded })}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
            {level > 0 && <SubdirectoryArrowRightIcon fontSize="small" color="action" />}
            <FolderIcon color="action" />
            
            <TextField
              size="small"
              placeholder="그룹 이름"
              value={node.name}
              onChange={(e) => updateNode(node.id, { name: e.target.value })}
              sx={{ width: 200 }}
            />
            
            <TextField
              size="small"
              placeholder="경로 (path)"
              value={node.path}
              onChange={(e) => updateNode(node.id, { path: e.target.value })}
              sx={{ width: 150 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={node.visibility || defaults.visibility}
                onChange={(e) => updateNode(node.id, { visibility: e.target.value as any })}
              >
                <MenuItem value="private">Private</MenuItem>
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              size="small"
              placeholder="설명 (선택사항)"
              value={node.description || ''}
              onChange={(e) => updateNode(node.id, { description: e.target.value })}
              sx={{ flex: 1 }}
            />
            
            <IconButton
              size="small"
              color="primary"
              onClick={() => addNode(nodes, node.id)}
              title="서브그룹 추가"
            >
              <AddIcon />
            </IconButton>
            
            <IconButton
              size="small"
              color="error"
              onClick={() => deleteNode(node.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Paper>
        
        {isExpanded && node.subgroups && node.subgroups.map(subnode => 
          renderNode(subnode, level + 1)
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">계층 구조 빌더</Typography>
          <Box>
            <Chip label={`부모 그룹 ID: ${parentId}`} sx={{ mr: 2 }} />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => addNode()}
            >
              최상위 그룹 추가
            </Button>
          </Box>
        </Box>

        {/* 기본 설정 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>기본 설정</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small">
              <InputLabel>기본 공개 범위</InputLabel>
              <Select
                value={defaults.visibility}
                onChange={(e) => setDefaults({ ...defaults, visibility: e.target.value as any })}
                label="기본 공개 범위"
              >
                <MenuItem value="private">Private</MenuItem>
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* 노드 트리 */}
        <Box sx={{ mb: 3 }}>
          {nodes.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              상단의 "최상위 그룹 추가" 버튼을 클릭하여 시작하세요
            </Typography>
          ) : (
            nodes.map(node => renderNode(node))
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={generateYaml}
            disabled={nodes.length === 0}
          >
            YAML 생성
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};