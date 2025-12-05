/**
 * useSequentialBulkOperation
 * 항목별 순차 처리를 통한 실시간 진행률 표시
 *
 * 특징:
 * - 각 항목을 개별적으로 처리하여 실제 진행률 표시
 * - 항목별 상태 (대기/처리중/완료/실패) 추적
 * - 취소 기능 지원
 * - 일시정지/재개 기능 지원
 */

import { useState, useCallback, useRef } from 'react';
import { useNotification } from './useNotification';
import { IdConverter } from '../utils/idConverter';

export type ItemStatus = 'pending' | 'processing' | 'success' | 'error' | 'cancelled';

export interface ProcessingItem {
  id: string | number;
  name: string;
  type: 'group' | 'project';
  full_path?: string;
  status: ItemStatus;
  error?: string;
}

export interface SequentialOperationState {
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  items: ProcessingItem[];
  currentIndex: number;
  completed: number;
  failed: number;
  total: number;
  progress: number;
  startTime: Date | null;
  error: string | null;
}

export interface SequentialOperationOptions {
  /** 각 항목 처리 사이의 지연 시간 (ms) */
  delayBetweenItems?: number;
  /** 작업 완료 시 콜백 */
  onComplete?: (result: SequentialOperationResult) => void;
  /** 작업 취소 시 콜백 */
  onCancel?: () => void;
  /** 항목 처리 완료 시 콜백 */
  onItemComplete?: (item: ProcessingItem, index: number) => void;
}

export interface SequentialOperationResult {
  success: ProcessingItem[];
  failed: ProcessingItem[];
  cancelled: ProcessingItem[];
  total: number;
  duration: number;
}

export function useSequentialBulkOperation(options: SequentialOperationOptions = {}) {
  const { delayBetweenItems = 300, onComplete, onCancel, onItemComplete } = options;

  const [state, setState] = useState<SequentialOperationState>({
    isRunning: false,
    isPaused: false,
    isCancelled: false,
    items: [],
    currentIndex: -1,
    completed: 0,
    failed: 0,
    total: 0,
    progress: 0,
    startTime: null,
    error: null,
  });

  const { showSuccess, showError, showWarning } = useNotification();

  // 취소/일시정지 플래그를 위한 ref
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  /**
   * 작업 시작
   */
  const execute = useCallback(async <T extends { id: string | number; name: string; type: 'group' | 'project'; full_path?: string }>(
    items: T[],
    processFn: (item: T) => Promise<void>
  ) => {
    if (items.length === 0) return;

    // 초기화
    cancelRef.current = false;
    pauseRef.current = false;

    const processingItems: ProcessingItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      full_path: item.full_path,
      status: 'pending' as ItemStatus,
    }));

    setState({
      isRunning: true,
      isPaused: false,
      isCancelled: false,
      items: processingItems,
      currentIndex: 0,
      completed: 0,
      failed: 0,
      total: items.length,
      progress: 0,
      startTime: new Date(),
      error: null,
    });

    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      // 취소 확인
      if (cancelRef.current) {
        // 남은 항목 취소 처리
        setState(prev => ({
          ...prev,
          items: prev.items.map((item, idx) =>
            idx >= i ? { ...item, status: 'cancelled' } : item
          ),
          isCancelled: true,
          isRunning: false,
        }));

        onCancel?.();
        showWarning('작업이 취소되었습니다');
        return;
      }

      // 일시정지 대기
      while (pauseRef.current && !cancelRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 현재 항목 처리 중 상태로 변경
      setState(prev => ({
        ...prev,
        currentIndex: i,
        items: prev.items.map((item, idx) =>
          idx === i ? { ...item, status: 'processing' } : item
        ),
      }));

      try {
        // 실제 처리
        await processFn(items[i]);

        completedCount++;

        // 성공 상태로 변경
        setState(prev => {
          const newItems = prev.items.map((item, idx) =>
            idx === i ? { ...item, status: 'success' as ItemStatus } : item
          );
          const newCompleted = prev.completed + 1;
          return {
            ...prev,
            items: newItems,
            completed: newCompleted,
            progress: Math.round(((newCompleted + prev.failed) / prev.total) * 100),
          };
        });

        onItemComplete?.(processingItems[i], i);

      } catch (error: any) {
        failedCount++;

        // 실패 상태로 변경
        setState(prev => {
          const newItems = prev.items.map((item, idx) =>
            idx === i ? {
              ...item,
              status: 'error' as ItemStatus,
              error: error.message || '처리 실패'
            } : item
          );
          const newFailed = prev.failed + 1;
          return {
            ...prev,
            items: newItems,
            failed: newFailed,
            progress: Math.round(((prev.completed + newFailed) / prev.total) * 100),
          };
        });
      }

      // 다음 항목 전 지연
      if (i < items.length - 1 && !cancelRef.current) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenItems));
      }
    }

    // 완료
    const endTime = new Date();
    const startTime = state.startTime || new Date();
    const duration = endTime.getTime() - startTime.getTime();

    setState(prev => ({
      ...prev,
      isRunning: false,
      currentIndex: -1,
      progress: 100,
    }));

    // 결과 생성
    const finalItems = processingItems.map((item, idx) => ({
      ...item,
      status: cancelRef.current && idx >= completedCount + failedCount
        ? 'cancelled' as ItemStatus
        : item.status,
    }));

    const result: SequentialOperationResult = {
      success: finalItems.filter(i => i.status === 'success'),
      failed: finalItems.filter(i => i.status === 'error'),
      cancelled: finalItems.filter(i => i.status === 'cancelled'),
      total: items.length,
      duration,
    };

    // 결과 알림
    if (failedCount === 0 && completedCount > 0) {
      showSuccess(`${completedCount}개 항목이 성공적으로 처리되었습니다`);
    } else if (failedCount > 0 && completedCount > 0) {
      showWarning(`${completedCount}개 성공, ${failedCount}개 실패`);
    } else if (failedCount > 0 && completedCount === 0) {
      showError('모든 항목 처리에 실패했습니다');
    }

    onComplete?.(result);

    return result;
  }, [delayBetweenItems, onComplete, onCancel, onItemComplete, showSuccess, showError, showWarning, state.startTime]);

  /**
   * 작업 취소
   */
  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /**
   * 일시정지
   */
  const pause = useCallback(() => {
    pauseRef.current = true;
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  /**
   * 재개
   */
  const resume = useCallback(() => {
    pauseRef.current = false;
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    cancelRef.current = false;
    pauseRef.current = false;
    setState({
      isRunning: false,
      isPaused: false,
      isCancelled: false,
      items: [],
      currentIndex: -1,
      completed: 0,
      failed: 0,
      total: 0,
      progress: 0,
      startTime: null,
      error: null,
    });
  }, []);

  /**
   * 항목 ID를 숫자로 변환
   */
  const prepareItems = useCallback(<T extends { id: string | number }>(items: T[]) => {
    return items.map(item => ({
      ...item,
      id: IdConverter.toNumeric(item.id),
    }));
  }, []);

  return {
    ...state,
    execute,
    cancel,
    pause,
    resume,
    reset,
    prepareItems,
    // 편의 속성
    isComplete: !state.isRunning && state.progress === 100,
    hasErrors: state.failed > 0,
    currentItem: state.currentIndex >= 0 ? state.items[state.currentIndex] : null,
  };
}

export default useSequentialBulkOperation;
