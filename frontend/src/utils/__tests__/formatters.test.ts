import { 
  formatBytes, 
  formatDate, 
  formatNumber, 
  formatDuration,
  formatPercentage,
  truncateText,
  capitalizeFirst,
  slugify
} from '../format';

describe('format utilities', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });
  });

  describe('formatDate', () => {
    it('should format dates in Korean locale', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      // The exact format depends on timezone
      const formatted = formatDate(date);
      expect(formatted).toMatch(/2024/);
      expect(formatted).toMatch(/01/);
    });

    it('should handle string dates', () => {
      const formatted = formatDate('2024-01-01');
      expect(formatted).toMatch(/2024/);
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with Korean locale', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle decimals', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('formatDuration', () => {
    it('should format duration in Korean', () => {
      expect(formatDuration(0)).toBe('0초');
      expect(formatDuration(45)).toBe('45초');
      expect(formatDuration(90)).toBe('1분 30초');
      expect(formatDuration(3661)).toBe('1시간 1분 1초');
    });
  });

  describe('formatPercentage', () => {
    it('should calculate percentages correctly', () => {
      expect(formatPercentage(50, 100)).toBe('50%');
      expect(formatPercentage(33, 100)).toBe('33%');
      expect(formatPercentage(0, 100)).toBe('0%');
    });

    it('should handle division by zero', () => {
      expect(formatPercentage(10, 0)).toBe('0%');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      expect(truncateText('This is a long text', 10)).toBe('This is...');
      expect(truncateText('Short', 10)).toBe('Short');
    });
  });

  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello');
      expect(capitalizeFirst('HELLO')).toBe('HELLO');
      expect(capitalizeFirst('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('should create URL-friendly slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test & Demo')).toBe('test-demo');
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });
  });
});