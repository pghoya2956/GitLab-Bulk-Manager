/**
 * 항목 필터링 유틸리티
 * 타입별 분리, 그룹화 등 공통 필터링 로직
 */

import { EntityType } from './idConverter';

export interface FilterableItem {
  id: string | number;
  type: string;
  name?: string;
  [key: string]: any;
}

export interface SeparatedItems<T> {
  groups: T[];
  projects: T[];
}

export class ItemFilter {
  /**
   * 타입으로 항목 필터링
   * @example
   * const projects = ItemFilter.filterByType(items, 'project');
   */
  static filterByType<T extends { type: string }>(
    items: T[],
    type: string
  ): T[] {
    return items.filter(item => item.type === type);
  }
  
  /**
   * 그룹과 프로젝트로 분리
   * @example
   * const { groups, projects } = ItemFilter.separateByType(selectedItems);
   */
  static separateByType<T extends { type: EntityType | string }>(
    items: T[]
  ): SeparatedItems<T> {
    return {
      groups: items.filter(item => item.type === 'group'),
      projects: items.filter(item => item.type === 'project')
    };
  }
  
  /**
   * 타입별로 그룹화
   * @example
   * const grouped = ItemFilter.groupByType(items);
   * // { group: [...], project: [...], other: [...] }
   */
  static groupByType<T extends { type: string }>(
    items: T[]
  ): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const type = item.type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
  
  /**
   * 속성으로 그룹화
   * @example
   * const byStatus = ItemFilter.groupBy(items, 'status');
   */
  static groupBy<T, K extends keyof T>(
    items: T[],
    key: K
  ): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
  
  /**
   * 고유 항목만 추출 (ID 기준)
   * @example
   * const unique = ItemFilter.unique(items);
   */
  static unique<T extends { id: string | number }>(items: T[]): T[] {
    const seen = new Set<string | number>();
    return items.filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }
  
  /**
   * 두 배열의 교집합
   * @example
   * const common = ItemFilter.intersection(array1, array2, 'id');
   */
  static intersection<T>(
    items1: T[],
    items2: T[],
    key: keyof T
  ): T[] {
    const set2 = new Set(items2.map(item => item[key]));
    return items1.filter(item => set2.has(item[key]));
  }
  
  /**
   * 두 배열의 차집합
   * @example
   * const diff = ItemFilter.difference(array1, array2, 'id');
   */
  static difference<T>(
    items1: T[],
    items2: T[],
    key: keyof T
  ): T[] {
    const set2 = new Set(items2.map(item => item[key]));
    return items1.filter(item => !set2.has(item[key]));
  }
  
  /**
   * 검색어로 필터링
   * @example
   * const results = ItemFilter.search(items, 'test', ['name', 'description']);
   */
  static search<T extends Record<string, any>>(
    items: T[],
    query: string,
    fields: (keyof T)[]
  ): T[] {
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      fields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery);
        }
        return false;
      })
    );
  }
  
  /**
   * 페이지네이션
   * @example
   * const page = ItemFilter.paginate(items, 2, 10); // 2페이지, 10개씩
   */
  static paginate<T>(
    items: T[],
    page: number,
    pageSize: number
  ): {
    items: T[];
    totalPages: number;
    currentPage: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
      items: items.slice(startIndex, endIndex),
      totalPages,
      currentPage,
      totalItems,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };
  }
  
  /**
   * 정렬
   * @example
   * const sorted = ItemFilter.sort(items, 'name', 'asc');
   */
  static sort<T>(
    items: T[],
    key: keyof T,
    order: 'asc' | 'desc' = 'asc'
  ): T[] {
    return [...items].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return order === 'asc' ? comparison : -comparison;
    });
  }
  
  /**
   * 다중 조건 정렬
   * @example
   * const sorted = ItemFilter.sortBy(items, [
   *   { key: 'type', order: 'asc' },
   *   { key: 'name', order: 'desc' }
   * ]);
   */
  static sortBy<T>(
    items: T[],
    criteria: Array<{ key: keyof T; order?: 'asc' | 'desc' }>
  ): T[] {
    return [...items].sort((a, b) => {
      for (const { key, order = 'asc' } of criteria) {
        const aVal = a[key];
        const bVal = b[key];
        
        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return order === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
  }
  
  /**
   * 항목 개수 통계
   * @example
   * const stats = ItemFilter.getStats(items);
   * // { total: 10, byType: { group: 3, project: 7 } }
   */
  static getStats<T extends { type: string }>(items: T[]): {
    total: number;
    byType: Record<string, number>;
  } {
    const byType = this.groupByType(items);
    const typeStats = Object.entries(byType).reduce((acc, [type, items]) => {
      acc[type] = items.length;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: items.length,
      byType: typeStats
    };
  }
}