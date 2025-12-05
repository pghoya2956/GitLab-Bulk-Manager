/**
 * 트리 선택 상태 관리를 위한 Custom Hook
 * 체크박스 선택, 부모-자식 연동, 선택 아이템 관리
 */

import { useState, useCallback, useMemo } from 'react';
import { ItemFilter } from '../utils/itemFilter';

export interface SelectableItem {
  id: string | number;
  type: 'group' | 'project';
  name: string;
  parent_id?: number;
  [key: string]: any;
}

export interface SelectionStats {
  total: number;
  groups: number;
  projects: number;
  byType: Record<string, number>;
}

export interface UseTreeSelectionOptions {
  multiSelect?: boolean;
  cascadeSelection?: boolean; // 부모 선택 시 자식도 선택
  allowMixedTypes?: boolean; // 그룹과 프로젝트 동시 선택 허용
  maxSelection?: number;
  onSelectionChange?: (selected: string[]) => void;
}

export function useTreeSelection(
  items: SelectableItem[] = [],
  options: UseTreeSelectionOptions = {}
) {
  const {
    multiSelect = true,
    cascadeSelection = true,
    allowMixedTypes = true,
    maxSelection,
    onSelectionChange
  } = options;
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // 아이템 맵 생성
  const itemMap = useMemo(() => {
    const map = new Map<string, SelectableItem>();
    items.forEach(item => {
      const id = typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`;
      map.set(id, item);
    });
    return map;
  }, [items]);
  
  // 부모-자식 관계 맵
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    
    items.forEach(item => {
      const itemId = typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`;
      
      if (item.parent_id) {
        const parentId = `group-${item.parent_id}`;
        const children = map.get(parentId) || [];
        children.push(itemId);
        map.set(parentId, children);
      }
    });
    
    return map;
  }, [items]);
  
  // 모든 자손 노드 가져오기
  const getAllDescendants = useCallback((nodeId: string): string[] => {
    const descendants: string[] = [];
    const children = childrenMap.get(nodeId) || [];
    
    children.forEach(childId => {
      descendants.push(childId);
      descendants.push(...getAllDescendants(childId));
    });
    
    return descendants;
  }, [childrenMap]);
  
  // 단일 선택
  const selectSingle = useCallback((nodeId: string) => {
    const newSelected = new Set<string>([nodeId]);
    setSelected(newSelected);
    
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSelected));
    }
  }, [onSelectionChange]);
  
  // 다중 선택 토글
  const toggleSelection = useCallback((nodeId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      
      if (next.has(nodeId)) {
        // 선택 해제
        next.delete(nodeId);
        
        // 캐스케이드 선택 해제
        if (cascadeSelection) {
          const descendants = getAllDescendants(nodeId);
          descendants.forEach(id => next.delete(id));
        }
      } else {
        // 선택
        if (maxSelection && next.size >= maxSelection) {
          return prev; // 최대 선택 수 초과
        }
        
        const item = itemMap.get(nodeId);
        if (!allowMixedTypes && item) {
          // 타입 체크
          const hasOtherType = Array.from(next).some(id => {
            const selectedItem = itemMap.get(id);
            return selectedItem && selectedItem.type !== item.type;
          });
          
          if (hasOtherType) {
            return prev; // 다른 타입 선택 불가
          }
        }
        
        next.add(nodeId);
        
        // 캐스케이드 선택
        if (cascadeSelection) {
          const descendants = getAllDescendants(nodeId);
          descendants.forEach(id => {
            if (!maxSelection || next.size < maxSelection) {
              next.add(id);
            }
          });
        }
      }
      
      if (onSelectionChange) {
        onSelectionChange(Array.from(next));
      }
      
      return next;
    });
  }, [cascadeSelection, getAllDescendants, itemMap, allowMixedTypes, maxSelection, onSelectionChange]);
  
  // 선택/해제
  const select = useCallback((nodeId: string) => {
    if (!multiSelect) {
      selectSingle(nodeId);
    } else {
      toggleSelection(nodeId);
    }
  }, [multiSelect, selectSingle, toggleSelection]);
  
  // 모두 선택
  const selectAll = useCallback(() => {
    const allIds = items.map(item => 
      typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`
    );
    
    const newSelected = new Set<string>(
      maxSelection ? allIds.slice(0, maxSelection) : allIds
    );
    
    setSelected(newSelected);
    
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSelected));
    }
  }, [items, maxSelection, onSelectionChange]);
  
  // 모두 해제
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);
  
  // 선택 반전
  const invertSelection = useCallback(() => {
    setSelected(prev => {
      const next = new Set<string>();
      
      items.forEach(item => {
        const id = typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`;
        if (!prev.has(id)) {
          if (!maxSelection || next.size < maxSelection) {
            next.add(id);
          }
        }
      });
      
      if (onSelectionChange) {
        onSelectionChange(Array.from(next));
      }
      
      return next;
    });
  }, [items, maxSelection, onSelectionChange]);
  
  // 타입별 선택
  const selectByType = useCallback((type: 'group' | 'project') => {
    const filtered = items
      .filter(item => item.type === type)
      .map(item => typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`);
    
    const newSelected = new Set<string>(
      maxSelection ? filtered.slice(0, maxSelection) : filtered
    );
    
    setSelected(newSelected);
    
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSelected));
    }
  }, [items, maxSelection, onSelectionChange]);
  
  // 확장/축소 토글
  const toggleExpanded = useCallback((nodeId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);
  
  // 모두 확장
  const expandAll = useCallback(() => {
    const allGroupIds = items
      .filter(item => item.type === 'group')
      .map(item => typeof item.id === 'string' ? item.id : `${item.type}-${item.id}`);
    
    setExpanded(new Set(allGroupIds));
  }, [items]);
  
  // 모두 축소
  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);
  
  // 선택된 아이템 가져오기
  const getSelectedItems = useCallback((): SelectableItem[] => {
    return Array.from(selected)
      .map(id => itemMap.get(id))
      .filter((item): item is SelectableItem => item !== undefined);
  }, [selected, itemMap]);
  
  // 선택 통계
  const stats = useMemo((): SelectionStats => {
    const selectedItems = getSelectedItems();
    const { groups, projects } = ItemFilter.separateByType(selectedItems);
    
    return {
      total: selectedItems.length,
      groups: groups.length,
      projects: projects.length,
      byType: Object.entries(ItemFilter.groupByType(selectedItems)).reduce((acc, [type, items]) => {
        acc[type] = items.length;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [getSelectedItems]);
  
  // 노드 선택 상태 확인
  const isSelected = useCallback((nodeId: string): boolean => {
    return selected.has(nodeId);
  }, [selected]);
  
  // 노드 확장 상태 확인
  const isExpanded = useCallback((nodeId: string): boolean => {
    return expanded.has(nodeId);
  }, [expanded]);
  
  // 부분 선택 상태 확인 (자식 중 일부만 선택됨)
  const isIndeterminate = useCallback((nodeId: string): boolean => {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return false;
    
    const descendants = getAllDescendants(nodeId);
    if (descendants.length === 0) return false;
    
    const selectedCount = descendants.filter(id => selected.has(id)).length;
    return selectedCount > 0 && selectedCount < descendants.length;
  }, [childrenMap, getAllDescendants, selected]);
  
  return {
    // 상태
    selected: Array.from(selected),
    expanded: Array.from(expanded),
    selectedItems: getSelectedItems(),
    stats,
    
    // 선택 액션
    select,
    selectAll,
    clearSelection,
    invertSelection,
    selectByType,
    toggleSelection,
    
    // 확장 액션
    toggleExpanded,
    expandAll,
    collapseAll,
    
    // 상태 확인
    isSelected,
    isExpanded,
    isIndeterminate,
    
    // 유틸리티
    hasSelection: selected.size > 0,
    selectionCount: selected.size,
    canSelectMore: !maxSelection || selected.size < maxSelection
  };
}