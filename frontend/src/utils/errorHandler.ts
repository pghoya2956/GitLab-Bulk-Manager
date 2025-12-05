/**
 * 에러 처리 유틸리티
 * 일관된 에러 처리 및 사용자 친화적 메시지 제공
 */

import axios, { AxiosError } from 'axios';

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

// 기존 인터페이스와 호환성 유지
export interface ApiError {
  message: string;
  statusCode?: number;
  details?: unknown;
}

export interface HandledError extends ApiError {
  code: ErrorCode;
  retryable: boolean;
  userMessage: string;
  timestamp: number;
}

interface GitLabApiError {
  message?: string;
  error?: string;
  error_description?: string;
  errors?: Record<string, string[]>;
}

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<number, string> = {
    400: '잘못된 요청입니다. 입력 내용을 확인해주세요.',
    401: '인증이 필요합니다. 다시 로그인해주세요.',
    403: '권한이 없습니다. 접근 권한을 확인해주세요.',
    404: '요청한 리소스를 찾을 수 없습니다.',
    409: '충돌이 발생했습니다. 이미 존재하는 항목입니다.',
    422: '처리할 수 없는 요청입니다. 데이터를 확인해주세요.',
    429: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
    500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    502: '게이트웨이 오류가 발생했습니다.',
    503: '서비스를 일시적으로 사용할 수 없습니다.',
    504: '요청 시간이 초과되었습니다.'
  };
  
  /**
   * 에러 처리 및 정규화
   */
  static handle(error: unknown): HandledError {
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }
    
    // 타임아웃
    if ((error as any)?.code === 'ECONNABORTED') {
      return {
        message: 'Request timeout',
        code: ErrorCode.TIMEOUT,
        retryable: true,
        userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
        timestamp: Date.now()
      };
    }
    
    // 일반 에러
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      message,
      code: ErrorCode.UNKNOWN,
      details: error,
      retryable: false,
      userMessage: message === 'Unknown error occurred' ? '알 수 없는 오류가 발생했습니다.' : message,
      timestamp: Date.now()
    };
  }
  
  private static handleAxiosError(error: AxiosError<GitLabApiError>): HandledError {
    // HTTP 응답이 있는 경우
    if (error.response) {
      const { status, data } = error.response;
      const code = this.getErrorCode(status);
      
      // GitLab API 에러 메시지 추출
      let message = data?.message || data?.error || '';
      let userMessage = this.ERROR_MESSAGES[status] || message;
      
      // GitLab form errors 처리
      if (data?.errors) {
        const errorMessages = Object.entries(data.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        message = errorMessages;
        userMessage = `검증 오류: ${errorMessages}`;
      }
      
      return {
        message: message || `Request failed with status ${status}`,
        statusCode: status,
        code,
        details: data,
        retryable: status >= 500 || status === 429,
        userMessage,
        timestamp: Date.now()
      };
    }
    
    // 네트워크 에러 (응답 없음)
    if (error.request) {
      return {
        message: 'Network request failed',
        code: ErrorCode.NETWORK_ERROR,
        details: error.request,
        retryable: true,
        userMessage: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
        timestamp: Date.now()
      };
    }
    
    // 요청 설정 에러
    return {
      message: error.message,
      code: ErrorCode.UNKNOWN,
      details: error,
      retryable: false,
      userMessage: error.message,
      timestamp: Date.now()
    };
  }
  
  private static getErrorCode(status: number): ErrorCode {
    switch (status) {
      case 401: return ErrorCode.UNAUTHORIZED;
      case 403: return ErrorCode.FORBIDDEN;
      case 404: return ErrorCode.NOT_FOUND;
      case 409: return ErrorCode.CONFLICT;
      case 429: return ErrorCode.RATE_LIMIT;
      default:
        if (status >= 400 && status < 500) return ErrorCode.VALIDATION_ERROR;
        if (status >= 500) return ErrorCode.SERVER_ERROR;
        return ErrorCode.UNKNOWN;
    }
  }
  
  /**
   * 재시도 로직
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      onRetry?: (attempt: number, error: HandledError) => void;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, delay = 1000, backoff = true, onRetry } = options;
    let lastError: HandledError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handle(error);
        
        if (!lastError.retryable || attempt === maxRetries) {
          throw error;
        }
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        const waitTime = backoff 
          ? Math.min(delay * Math.pow(2, attempt - 1), 30000)
          : delay;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError!;
  }
}

// 기존 함수와의 호환성 유지
export const handleApiError = (error: unknown): ApiError => {
  const handled = ErrorHandler.handle(error);
  return {
    message: handled.message,
    statusCode: handled.statusCode,
    details: handled.details
  };
};

export const getErrorMessage = (error: unknown): string => {
  return ErrorHandler.handle(error).userMessage;
};