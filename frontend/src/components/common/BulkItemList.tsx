/**
 * BulkItemList - 선택된 아이템 목록 표시 컴포넌트
 * 그룹/프로젝트 목록을 일관된 형식으로 표시
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  Paper,
  Collapse,
  Checkbox,
  Badge,
} from '@mui/material';
import {
  FolderOpen,
  Assignment,
  Search,
  Clear,
  ExpandLess,
  ExpandMore,
  Delete,
  Visibility,
  VisibilityOff,
  Archive,
} from '@mui/icons-material';
import { ItemFilter } from '../../utils/itemFilter';

export interface BulkItem {
  id: string | number;
  name: string;
  type: 'group' | 'project';
  full_path?: string;
  path_with_namespace?: string;
  description?: string;
  archived?: boolean;
  visibility?: 'private' | 'internal' | 'public';
  [key: string]: any;
}

export interface BulkItemListProps {
  items: BulkItem[];
  title?: string;
  searchable?: boolean;
  selectable?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showStats?: boolean;
  showActions?: boolean;
  maxHeight?: number | string;
  onItemClick?: (item: BulkItem) => void;
  onItemRemove?: (item: BulkItem) => void;
  onSelectionChange?: (selected: BulkItem[]) => void;
  renderItem?: (item: BulkItem) => React.ReactNode;
  emptyMessage?: string;
  groupBy?: 'type' | 'visibility' | 'archived' | null;
}

export const BulkItemList: React.FC<BulkItemListProps> = ({
  items,
  title,
  searchable = false,
  selectable = false,
  collapsible = false,
  defaultExpanded = true,
  showStats = true,
  showActions = false,
  maxHeight = 400,
  onItemClick,
  onItemRemove,
  onSelectionChange,
  renderItem,
  emptyMessage = '항목이 없습니다',
  groupBy = null,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [sortBy] = useState<'name' | 'type' | 'path'>('name');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');

  // 아이템 필터링 및 정렬
  const processedItems = useMemo(() => {
    let result = [...items];

    // 검색 필터
    if (searchQuery) {
      result = ItemFilter.search(result, searchQuery, ['name', 'full_path', 'description']);
    }

    // 정렬
    result = ItemFilter.sort(result, sortBy, sortOrder);

    return result;
  }, [items, searchQuery, sortBy, sortOrder]);

  // 그룹화된 아이템
  const groupedItems = useMemo(() => {
    if (!groupBy) return { default: processedItems };

    return ItemFilter.groupByType(processedItems);
  }, [processedItems, groupBy]);

  // 통계
  const stats = useMemo(() => {
    const { groups, projects } = ItemFilter.separateByType(items);
    return {
      total: items.length,
      groups: groups.length,
      projects: projects.length,
    };
  }, [items]);


  const handleSelectItem = (item: BulkItem) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedIds(newSelected);
    
    const selectedItems = items.filter(i => newSelected.has(i.id));
    onSelectionChange?.(selectedItems);
  };

  const getItemIcon = (item: BulkItem) => {
    const baseIcon = item.type === 'group' ? (
      <FolderOpen color="primary" />
    ) : (
      <Assignment color="secondary" />
    );

    if (item.archived) {
      return (
        <Badge badgeContent={<Archive fontSize="small" />} color="warning">
          {baseIcon}
        </Badge>
      );
    }

    return baseIcon;
  };

  const getVisibilityIcon = (visibility?: string) => {
    switch (visibility) {
      case 'private':
        return <VisibilityOff fontSize="small" color="action" />;
      case 'public':
        return <Visibility fontSize="small" color="action" />;
      default:
        return null;
    }
  };

  const renderDefaultItem = (item: BulkItem) => {
    const path = item.full_path || item.path_with_namespace;
    
    return (
      <ListItem
        onClick={() => onItemClick?.(item)}
        selected={selectedIds.has(item.id)}
      >
        {selectable && (
          <Checkbox
            edge="start"
            checked={selectedIds.has(item.id)}
            onChange={() => handleSelectItem(item)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <ListItemIcon>{getItemIcon(item)}</ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{item.name}</Typography>
              {item.visibility ? getVisibilityIcon(item.visibility) : null}
            </Box>
          }
          secondary={
            <Box>
              {path && (
                <Typography variant="caption" color="text.secondary">
                  {path}
                </Typography>
              )}
              {item.description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.description}
                </Typography>
              )}
            </Box>
          }
        />
        {showActions && onItemRemove && (
          <ListItemSecondaryAction>
            <IconButton
              edge="end"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onItemRemove(item);
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </ListItemSecondaryAction>
        )}
      </ListItem>
    );
  };

  const renderGroupedLists = () => {
    return Object.entries(groupedItems).map(([groupName, groupItems]) => (
      <Box key={groupName} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {groupName === 'group' ? '그룹' : groupName === 'project' ? '프로젝트' : groupName}
          <Chip label={groupItems.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        <List dense>
          {groupItems.map((item) =>
            renderItem ? renderItem(item) : renderDefaultItem(item)
          )}
        </List>
      </Box>
    ));
  };

  const content = (
    <Box>
      {/* 검색 바 */}
      {searchable && (
        <TextField
          size="small"
          fullWidth
          placeholder="검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      {/* 아이템 목록 */}
      {processedItems.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ maxHeight, overflow: 'auto' }}>
          {groupBy ? (
            renderGroupedLists()
          ) : (
            <List dense>
              {processedItems.map((item) =>
                renderItem ? renderItem(item) : renderDefaultItem(item)
              )}
            </List>
          )}
        </Box>
      )}
    </Box>
  );

  if (!collapsible) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        {title && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              {title}
            </Typography>
            {showStats && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  icon={<FolderOpen />}
                  label={`${stats.groups}개 그룹`}
                  size="small"
                  color="primary"
                />
                <Chip
                  icon={<Assignment />}
                  label={`${stats.projects}개 프로젝트`}
                  size="small"
                  color="secondary"
                />
              </Box>
            )}
          </Box>
        )}
        {content}
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {title || '선택된 항목'}
        </Typography>
        {showStats && !expanded && (
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Chip label={`총 ${stats.total}개`} size="small" />
          </Box>
        )}
        <IconButton size="small">
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          {showStats && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                icon={<FolderOpen />}
                label={`${stats.groups}개 그룹`}
                size="small"
                color="primary"
              />
              <Chip
                icon={<Assignment />}
                label={`${stats.projects}개 프로젝트`}
                size="small"
                color="secondary"
              />
            </Box>
          )}
          {content}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default BulkItemList;