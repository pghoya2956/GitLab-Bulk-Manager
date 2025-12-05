/**
 * useActionHistory - 작업 이력 관리 Hook
 * localStorage와 연동하여 작업 이력을 저장/조회
 */

import { useState, useEffect, useCallback } from 'react';

export interface ActionHistoryItem {
  id: string;
  type: string;
  status: 'success' | 'error' | 'warning' | 'running';
  message: string;
  timestamp: Date;
  progress?: number;
  metadata?: Record<string, any>;
}

interface UseActionHistoryOptions {
  maxItems?: number;
  storageKey?: string;
  autoSave?: boolean;
}

interface UseActionHistoryReturn {
  history: ActionHistoryItem[];
  addAction: (action: Omit<ActionHistoryItem, 'id' | 'timestamp'>) => void;
  updateAction: (id: string, updates: Partial<ActionHistoryItem>) => void;
  removeAction: (id: string) => void;
  clearHistory: () => void;
  getRunningActions: () => ActionHistoryItem[];
  getActionsByStatus: (status: ActionHistoryItem['status']) => ActionHistoryItem[];
  getRecentActions: (count: number) => ActionHistoryItem[];
  stats: {
    total: number;
    success: number;
    error: number;
    warning: number;
    running: number;
  };
}

export function useActionHistory(
  options: UseActionHistoryOptions = {}
): UseActionHistoryReturn {
  const {
    maxItems = 50,
    storageKey = 'bulkActionHistory',
    autoSave = true,
  } = options;

  const [history, setHistory] = useState<ActionHistoryItem[]>([]);

  // 초기 로드
  useEffect(() => {
    if (autoSave) {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          // Date 객체로 변환
          const historyWithDates = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
          setHistory(historyWithDates);
        } catch (error) {
          console.error('Failed to load action history:', error);
        }
      }
    }
  }, [storageKey, autoSave]);

  // 저장
  const saveToStorage = useCallback((items: ActionHistoryItem[]) => {
    if (autoSave) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
      } catch (error) {
        console.error('Failed to save action history:', error);
      }
    }
  }, [storageKey, autoSave]);

  // 액션 추가
  const addAction = useCallback((
    action: Omit<ActionHistoryItem, 'id' | 'timestamp'>
  ) => {
    const newAction: ActionHistoryItem = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setHistory(prev => {
      const updated = [newAction, ...prev].slice(0, maxItems);
      saveToStorage(updated);
      return updated;
    });
  }, [maxItems, saveToStorage]);

  // 액션 업데이트
  const updateAction = useCallback((
    id: string,
    updates: Partial<ActionHistoryItem>
  ) => {
    setHistory(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 액션 제거
  const removeAction = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 이력 초기화
  const clearHistory = useCallback(() => {
    setHistory([]);
    if (autoSave) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, autoSave]);

  // 진행 중인 액션 조회
  const getRunningActions = useCallback(() => {
    return history.filter(item => item.status === 'running');
  }, [history]);

  // 상태별 액션 조회
  const getActionsByStatus = useCallback((
    status: ActionHistoryItem['status']
  ) => {
    return history.filter(item => item.status === status);
  }, [history]);

  // 최근 액션 조회
  const getRecentActions = useCallback((count: number) => {
    return history.slice(0, count);
  }, [history]);

  // 통계
  const stats = {
    total: history.length,
    success: history.filter(item => item.status === 'success').length,
    error: history.filter(item => item.status === 'error').length,
    warning: history.filter(item => item.status === 'warning').length,
    running: history.filter(item => item.status === 'running').length,
  };

  return {
    history,
    addAction,
    updateAction,
    removeAction,
    clearHistory,
    getRunningActions,
    getActionsByStatus,
    getRecentActions,
    stats,
  };
}