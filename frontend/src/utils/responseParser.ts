/**
 * API 응답 파싱 유틸리티
 * 다양한 응답 구조를 통합 처리
 */

export interface BulkOperationResult {
  success: any[];
  failed: any[];
  skipped: any[];
  total: number;
  hasErrors: boolean;
  allSuccessful: boolean;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
}

export interface ParseOptions {
  successKeys?: string[];
  failedKeys?: string[];
  skippedKeys?: string[];
  extractDetails?: boolean;
}

export class ResponseParser {
  private static readonly DEFAULT_SUCCESS_KEYS = [
    'success', 'successful', 'created', 'deleted', 'updated', 
    'archived', 'unarchived', 'transferred', 'cloned'
  ];
  
  private static readonly DEFAULT_FAILED_KEYS = [
    'failed', 'errors', 'failures', 'error'
  ];
  
  private static readonly DEFAULT_SKIPPED_KEYS = [
    'skipped', 'ignored', 'existing', 'duplicates'
  ];
  
  /**
   * 통합 응답 파싱
   * @example
   * const response = { results: { success: [...], failed: [...] } };
   * const result = ResponseParser.parse(response);
   */
  static parse(
    response: any,
    options: ParseOptions = {}
  ): BulkOperationResult {
    const successKeys = options.successKeys || this.DEFAULT_SUCCESS_KEYS;
    const failedKeys = options.failedKeys || this.DEFAULT_FAILED_KEYS;
    const skippedKeys = options.skippedKeys || this.DEFAULT_SKIPPED_KEYS;
    
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      skipped: [],
      total: 0,
      hasErrors: false,
      allSuccessful: true,
      summary: {
        successCount: 0,
        failedCount: 0,
        skippedCount: 0
      }
    };
    
    // Null/undefined 체크
    if (!response) return result;
    
    // 응답 정규화 - 중첩된 구조 처리
    let data = response;
    if (response.data) data = response.data;
    if (response.results) data = response.results;
    if (data.data) data = data.data;
    if (data.results) data = data.results;
    
    // Success items 추출
    for (const key of successKeys) {
      if (data[key]) {
        result.success = this.ensureArray(data[key]);
        break;
      }
    }
    
    // Failed items 추출
    for (const key of failedKeys) {
      if (data[key]) {
        result.failed = this.ensureArray(data[key]);
        break;
      }
    }
    
    // Skipped items 추출
    for (const key of skippedKeys) {
      if (data[key]) {
        result.skipped = this.ensureArray(data[key]);
        break;
      }
    }
    
    // 배열 응답 처리 (직접 배열이 반환된 경우)
    if (Array.isArray(data) && result.success.length === 0 && result.failed.length === 0) {
      result.success = data;
    }
    
    // 메타데이터 계산
    result.summary.successCount = result.success.length;
    result.summary.failedCount = result.failed.length;
    result.summary.skippedCount = result.skipped.length;
    
    result.total = result.summary.successCount + 
                  result.summary.failedCount + 
                  result.summary.skippedCount;
    
    result.hasErrors = result.summary.failedCount > 0;
    result.allSuccessful = result.summary.failedCount === 0 && 
                          result.summary.successCount > 0;
    
    return result;
  }
  
  /**
   * 값을 배열로 변환
   */
  private static ensureArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  }
  
  /**
   * 응답이 성공인지 확인
   * @example
   * if (ResponseParser.isSuccess(response)) { ... }
   */
  static isSuccess(response: any): boolean {
    const result = this.parse(response);
    return result.allSuccessful;
  }
  
  /**
   * 응답에 에러가 있는지 확인
   */
  static hasErrors(response: any): boolean {
    const result = this.parse(response);
    return result.hasErrors;
  }
  
  /**
   * 에러 메시지 추출
   * @example
   * const errors = ResponseParser.extractErrors(response);
   * errors.forEach(err => console.error(err));
   */
  static extractErrors(response: any): string[] {
    const result = this.parse(response);
    return result.failed.map(item => {
      if (typeof item === 'string') return item;
      return item.error || item.message || item.reason || 'Unknown error';
    });
  }
  
  /**
   * 성공/실패 요약 문자열 생성
   * @example
   * ResponseParser.getSummary(response) // "성공: 5, 실패: 2, 건너뜀: 1"
   */
  static getSummary(response: any): string {
    const result = this.parse(response);
    const parts: string[] = [];
    
    if (result.summary.successCount > 0) {
      parts.push(`성공: ${result.summary.successCount}`);
    }
    if (result.summary.failedCount > 0) {
      parts.push(`실패: ${result.summary.failedCount}`);
    }
    if (result.summary.skippedCount > 0) {
      parts.push(`건너뜀: ${result.summary.skippedCount}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : '결과 없음';
  }
  
  /**
   * 여러 응답 병합
   * @example
   * const merged = ResponseParser.merge([response1, response2]);
   */
  static merge(responses: any[]): BulkOperationResult {
    const merged: BulkOperationResult = {
      success: [],
      failed: [],
      skipped: [],
      total: 0,
      hasErrors: false,
      allSuccessful: true,
      summary: {
        successCount: 0,
        failedCount: 0,
        skippedCount: 0
      }
    };
    
    for (const response of responses) {
      const result = this.parse(response);
      merged.success.push(...result.success);
      merged.failed.push(...result.failed);
      merged.skipped.push(...result.skipped);
    }
    
    // 메타데이터 재계산
    merged.summary.successCount = merged.success.length;
    merged.summary.failedCount = merged.failed.length;
    merged.summary.skippedCount = merged.skipped.length;
    merged.total = merged.summary.successCount + 
                  merged.summary.failedCount + 
                  merged.summary.skippedCount;
    merged.hasErrors = merged.summary.failedCount > 0;
    merged.allSuccessful = merged.summary.failedCount === 0 && 
                          merged.summary.successCount > 0;
    
    return merged;
  }
}