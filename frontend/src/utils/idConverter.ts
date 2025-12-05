/**
 * ID 변환 유틸리티
 * GitLab ID 형식 변환을 중앙화하여 코드 중복 제거
 */

export type EntityType = 'group' | 'project';
export type EntityId = string | number;

export interface IdConvertible {
  id: EntityId;
  type?: EntityType;
}

export class IdConverter {
  private static readonly SEPARATOR = '-';
  private static readonly PATTERN = /^(group|project)-(\d+)$/;
  
  /**
   * 문자열 ID를 숫자로 변환
   * @example 
   * IdConverter.toNumeric('group-123') // 123
   * IdConverter.toNumeric(456) // 456
   * IdConverter.toNumeric('project-789') // 789
   */
  static toNumeric(id: EntityId): number {
    if (typeof id === 'number') return id;
    
    const match = id.match(this.PATTERN);
    if (match) {
      return parseInt(match[2], 10);
    }
    
    // Fallback: 숫자 문자열인 경우
    const parsed = parseInt(id, 10);
    if (!isNaN(parsed)) return parsed;
    
    throw new Error(`Invalid ID format: ${id}`);
  }
  
  /**
   * 타입과 ID를 조합하여 문자열 ID 생성
   * @example
   * IdConverter.toString('group', 123) // 'group-123'
   */
  static toString(type: EntityType, id: number): string {
    return `${type}${this.SEPARATOR}${id}`;
  }
  
  /**
   * ID에서 타입 추출
   * @example
   * IdConverter.extractType('group-123') // 'group'
   * IdConverter.extractType('project-456') // 'project'
   * IdConverter.extractType(789) // null
   */
  static extractType(id: EntityId): EntityType | null {
    if (typeof id === 'number') return null;
    
    const match = id.match(this.PATTERN);
    return match ? match[1] as EntityType : null;
  }
  
  /**
   * 배치 변환 with 타입 보존
   * @example
   * const items = [{ id: 'group-1', name: 'G1' }, { id: 'project-2', name: 'P2' }];
   * IdConverter.convertBatch(items) 
   * // [{ id: 'group-1', name: 'G1', numericId: 1, originalId: 'group-1' }, ...]
   */
  static convertBatch<T extends IdConvertible>(
    items: T[]
  ): Array<T & { numericId: number; originalId: EntityId }> {
    return items.map(item => ({
      ...item,
      numericId: this.toNumeric(item.id),
      originalId: item.id
    }));
  }
  
  /**
   * ID 유효성 검사
   * @example
   * IdConverter.isValid('group-123') // true
   * IdConverter.isValid('invalid') // false
   */
  static isValid(id: EntityId): boolean {
    try {
      this.toNumeric(id);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 여러 ID를 숫자 배열로 변환
   * @example
   * IdConverter.toNumericArray(['group-1', 'project-2', 3]) // [1, 2, 3]
   */
  static toNumericArray(ids: EntityId[]): number[] {
    return ids.map(id => this.toNumeric(id));
  }
}