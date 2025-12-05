/**
 * 대량 작업을 위한 Custom Hook
 * 로딩, 에러, 결과 상태 관리 및 공통 작업 로직 제공
 */

import { useState, useCallback } from 'react';
import { useNotification } from './useNotification';
import { ResponseParser, BulkOperationResult } from '../utils/responseParser';
import { ErrorHandler, HandledError } from '../utils/errorHandler';
import { IdConverter } from '../utils/idConverter';

export interface BulkOperationOptions {
  successMessage?: (count: number) => string;
  errorMessage?: (count: number) => string;
  onSuccess?: (result: BulkOperationResult) => void;
  onError?: (error: HandledError) => void;
  onProgress?: (progress: number) => void;
  autoClose?: boolean;
  closeDelay?: number;
}

export interface BulkOperationState {
  loading: boolean;
  result: BulkOperationResult | null;
  error: HandledError | null;
  progress: number;
}

export function useBulkOperation(options: BulkOperationOptions = {}) {
  const [state, setState] = useState<BulkOperationState>({
    loading: false,
    result: null,
    error: null,
    progress: 0
  });
  
  const { showSuccess, showError } = useNotification();
  
  /**
   * 작업 실행
   */
  const execute = useCallback(async (
    operation: () => Promise<any>
  ) => {
    setState({
      loading: true,
      result: null,
      error: null,
      progress: 0
    });
    
    try {
      const response = await operation();
      
      // 응답 파싱
      const result = ResponseParser.parse(response);
      
      setState(prev => ({
        ...prev,
        loading: false,
        result,
        progress: 100
      }));
      
      // 성공 메시지 표시
      if (result.success.length > 0) {
        const message = options.successMessage
          ? options.successMessage(result.success.length)
          : `${result.success.length}개 항목이 성공적으로 처리되었습니다`;
        showSuccess(message);
      }
      
      // 실패 메시지 표시
      if (result.failed.length > 0) {
        const message = options.errorMessage
          ? options.errorMessage(result.failed.length)
          : `${result.failed.length}개 항목 처리 실패`;
        showError(message);
      }
      
      // 성공 콜백
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error) {
      const handledError = ErrorHandler.handle(error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: handledError,
        progress: 0
      }));
      
      showError(handledError.userMessage);
      
      // 에러 콜백
      if (options.onError) {
        options.onError(handledError);
      }
      
      throw handledError;
    }
  }, [options, showSuccess, showError]);
  
  /**
   * 진행률 업데이트
   */
  const updateProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
  }, []);
  
  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    setState({
      loading: false,
      result: null,
      error: null,
      progress: 0
    });
  }, []);
  
  /**
   * 아이템 ID 변환 헬퍼
   */
  const prepareItems = useCallback((items: any[]) => {
    return items.map(item => ({
      ...item,
      id: IdConverter.toNumeric(item.id),
      originalId: item.id
    }));
  }, []);
  
  /**
   * 재시도 로직
   */
  const retry = useCallback(async (
    operation: () => Promise<any>,
    maxRetries: number = 3
  ) => {
    let lastError: HandledError | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await execute(operation);
      } catch (error) {
        lastError = error as HandledError;
        
        if (!lastError.retryable || attempt === maxRetries) {
          throw lastError;
        }
        
        // 지수 백오프
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }, [execute]);
  
  return {
    ...state,
    execute,
    updateProgress,
    reset,
    prepareItems,
    retry,
    isSuccess: state.result?.allSuccessful || false,
    hasErrors: state.result?.hasErrors || false,
    summary: state.result?.summary || { successCount: 0, failedCount: 0, skippedCount: 0 }
  };
}

/**
 * 특정 작업 유형에 특화된 Hook 생성
 */
export function createBulkOperationHook(
  operationName: string,
  defaultOptions?: BulkOperationOptions
) {
  return (overrideOptions?: BulkOperationOptions) => {
    return useBulkOperation({
      ...defaultOptions,
      ...overrideOptions,
      successMessage: (count) => 
        overrideOptions?.successMessage?.(count) || 
        defaultOptions?.successMessage?.(count) ||
        `${count}개 항목이 ${operationName}되었습니다`,
      errorMessage: (count) =>
        overrideOptions?.errorMessage?.(count) ||
        defaultOptions?.errorMessage?.(count) ||
        `${count}개 항목 ${operationName} 실패`
    });
  };
}

// 작업별 특화 Hook
export const useBulkDelete = createBulkOperationHook('삭제', {
  successMessage: (count) => `${count}개 항목이 성공적으로 삭제되었습니다`
});

export const useBulkArchive = createBulkOperationHook('보관', {
  successMessage: (count) => `${count}개 프로젝트가 성공적으로 보관되었습니다`
});

export const useBulkTransfer = createBulkOperationHook('이동', {
  successMessage: (count) => `${count}개 항목이 성공적으로 이동되었습니다`
});

export const useBulkClone = createBulkOperationHook('복제', {
  successMessage: (count) => `${count}개 항목이 성공적으로 복제되었습니다`
});