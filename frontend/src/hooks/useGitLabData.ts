/**
 * GitLab 데이터 패칭 및 캐싱을 위한 Custom Hook
 * 그룹, 프로젝트, 멤버 등 GitLab 리소스 관리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { gitlabService } from '../services/gitlab';
import { ErrorHandler } from '../utils/errorHandler';
import { useNotification } from './useNotification';
import type { GitLabGroup, GitLabProject } from '../types/gitlab';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface FetchOptions {
  force?: boolean;
  cache?: boolean;
  ttl?: number; // Time to live in milliseconds
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

/**
 * 제네릭 데이터 패칭 Hook
 */
export function useGitLabData<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = [],
  options: FetchOptions = {}
) {
  const [state, setState] = useState<DataState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null
  });
  
  const cacheRef = useRef<CacheEntry<T> | null>(null);
  const { showError } = useNotification();
  
  const fetch = useCallback(async (forceFetch = false) => {
    // 캐시 확인
    if (!forceFetch && options.cache && cacheRef.current) {
      const now = Date.now();
      const cache = cacheRef.current;
      
      if (now - cache.timestamp < cache.ttl) {
        setState(prev => ({
          ...prev,
          data: cache.data,
          loading: false
        }));
        return cache.data;
      }
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fetcher();
      
      // 캐시 저장
      if (options.cache) {
        cacheRef.current = {
          data,
          timestamp: Date.now(),
          ttl: options.ttl || 5 * 60 * 1000 // 기본 5분
        };
      }
      
      setState({
        data,
        loading: false,
        error: null,
        lastFetch: new Date()
      });
      
      if (options.onSuccess) {
        options.onSuccess(data);
      }
      
      return data;
    } catch (error) {
      const handledError = ErrorHandler.handle(error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: handledError.userMessage
      }));
      
      if (options.onError) {
        options.onError(handledError);
      } else {
        showError(handledError.userMessage);
      }
      
      throw handledError;
    }
  }, [fetcher, options, showError]);
  
  const refresh = useCallback(() => {
    return fetch(true);
  }, [fetch]);
  
  const clear = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetch: null
    });
    cacheRef.current = null;
  }, []);
  
  useEffect(() => {
    if (!options.force) {
      fetch();
    }
  }, dependencies);
  
  return {
    ...state,
    fetch,
    refresh,
    clear,
    isLoading: state.loading,
    hasError: !!state.error,
    isEmpty: !state.data || (Array.isArray(state.data) && state.data.length === 0)
  };
}

/**
 * 그룹 데이터 Hook
 */
export function useGroups(options: FetchOptions = {}) {
  return useGitLabData<GitLabGroup[]>(
    () => gitlabService.getGroups({ per_page: 100 }),
    [],
    { cache: true, ttl: 10 * 60 * 1000, ...options } // 10분 캐시
  );
}

/**
 * 프로젝트 데이터 Hook
 */
export function useProjects(groupId?: number, options: FetchOptions = {}) {
  return useGitLabData<GitLabProject[]>(
    () => {
      if (groupId) {
        // GitLab API에서 그룹별 프로젝트 조회
        return gitlabService.getProjects({ per_page: 100 });
      }
      return gitlabService.getProjects({ per_page: 100 });
    },
    [groupId],
    { cache: true, ttl: 5 * 60 * 1000, ...options } // 5분 캐시
  );
}

/**
 * 그룹과 프로젝트 트리 데이터 Hook
 */
export interface TreeData {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  tree: TreeNode[];
}

export interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  children?: TreeNode[];
  data: GitLabGroup | GitLabProject;
}

export function useGitLabTree(options: FetchOptions = {}) {
  const [treeData, setTreeData] = useState<TreeData>({
    groups: [],
    projects: [],
    tree: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { showError } = useNotification();
  
  const buildTree = useCallback((groups: GitLabGroup[], projects: GitLabProject[]): TreeNode[] => {
    const groupMap = new Map<number, TreeNode>();
    const rootNodes: TreeNode[] = [];
    
    // 그룹 노드 생성
    groups.forEach(group => {
      const node: TreeNode = {
        id: `group-${group.id}`,
        name: group.name,
        type: 'group',
        children: [],
        data: group
      };
      groupMap.set(group.id, node);
    });
    
    // 그룹 계층 구조 구성
    groups.forEach(group => {
      const node = groupMap.get(group.id)!;
      
      if (group.parent_id) {
        const parent = groupMap.get(group.parent_id);
        if (parent) {
          parent.children!.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });
    
    // 프로젝트 추가
    projects.forEach(project => {
      const projectNode: TreeNode = {
        id: `project-${project.id}`,
        name: project.name,
        type: 'project',
        data: project
      };
      
      if (project.namespace?.id) {
        const parent = groupMap.get(project.namespace.id);
        if (parent) {
          parent.children!.push(projectNode);
        } else {
          rootNodes.push(projectNode);
        }
      } else {
        rootNodes.push(projectNode);
      }
    });
    
    return rootNodes;
  }, []);
  
  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [groups, projects] = await Promise.all([
        gitlabService.getGroups({ per_page: 100 }),
        gitlabService.getProjects({ per_page: 100 })
      ]);
      
      const tree = buildTree(groups, projects);
      
      setTreeData({
        groups,
        projects,
        tree
      });
      
      if (options.onSuccess) {
        options.onSuccess({ groups, projects, tree });
      }
    } catch (err) {
      const handledError = ErrorHandler.handle(err);
      setError(handledError.userMessage);
      
      if (options.onError) {
        options.onError(handledError);
      } else {
        showError(handledError.userMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [buildTree, options, showError]);
  
  useEffect(() => {
    fetchTree();
  }, []);
  
  return {
    ...treeData,
    loading,
    error,
    refresh: fetchTree,
    hasError: !!error
  };
}

/**
 * 페이지네이션이 있는 데이터 Hook
 */
export function usePaginatedData<T>(
  fetcher: (page: number, perPage: number) => Promise<{ data: T[]; total: number }>,
  perPage: number = 20
) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { showError } = useNotification();
  
  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcher(pageNum, perPage);
      setData(result.data);
      setTotal(result.total);
      setPage(pageNum);
    } catch (err) {
      const handledError = ErrorHandler.handle(err);
      setError(handledError.userMessage);
      showError(handledError.userMessage);
    } finally {
      setLoading(false);
    }
  }, [fetcher, perPage, showError]);
  
  const nextPage = useCallback(() => {
    const maxPage = Math.ceil(total / perPage);
    if (page < maxPage) {
      fetchPage(page + 1);
    }
  }, [page, total, perPage, fetchPage]);
  
  const prevPage = useCallback(() => {
    if (page > 1) {
      fetchPage(page - 1);
    }
  }, [page, fetchPage]);
  
  const goToPage = useCallback((pageNum: number) => {
    const maxPage = Math.ceil(total / perPage);
    if (pageNum >= 1 && pageNum <= maxPage) {
      fetchPage(pageNum);
    }
  }, [total, perPage, fetchPage]);
  
  useEffect(() => {
    fetchPage(1);
  }, []);
  
  return {
    data,
    page,
    total,
    loading,
    error,
    perPage,
    totalPages: Math.ceil(total / perPage),
    hasNext: page < Math.ceil(total / perPage),
    hasPrev: page > 1,
    nextPage,
    prevPage,
    goToPage,
    refresh: () => fetchPage(page)
  };
}