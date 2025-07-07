import { 
  isAxiosError, 
  getErrorMessage, 
  getAxiosErrorMessage,
  AppError,
  logError 
} from '../errorUtils';

describe('errorUtils', () => {
  describe('AppError', () => {
    it('should create custom error with properties', () => {
      const error = new AppError('Test error', 'TEST_CODE', 404, { field: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ field: 'value' });
    });
  });

  describe('isAxiosError', () => {
    it('should identify objects with response property', () => {
      const axiosLikeError = {
        response: {
          data: {},
          status: 400
        }
      };

      expect(isAxiosError(axiosLikeError)).toBe(true);
      expect(isAxiosError(new Error('Regular error'))).toBe(false);
      expect(isAxiosError(null)).toBe(false);
      expect(isAxiosError(undefined)).toBe(false);
      expect(isAxiosError({ noResponse: true })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract error message from various formats', () => {
      // Test string error
      expect(getErrorMessage('Simple error')).toBe('Simple error');

      // Test Error object
      expect(getErrorMessage(new Error('Error object'))).toBe('Error object');

      // Test object with message property
      expect(getErrorMessage({ message: 'Object with message' })).toBe('Object with message');

      // Test unknown error type
      expect(getErrorMessage({ foo: 'bar' })).toBe('An unknown error occurred');
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
      expect(getErrorMessage(123)).toBe('An unknown error occurred');
    });
  });

  describe('getAxiosErrorMessage', () => {
    it('should extract message from axios error response', () => {
      const axiosError = {
        response: {
          data: { message: 'API error message' },
          status: 400
        }
      };
      expect(getAxiosErrorMessage(axiosError)).toBe('API error message');
    });

    it('should extract error field from axios error response', () => {
      const axiosError = {
        response: {
          data: { error: 'API error field' },
          status: 400
        }
      };
      expect(getAxiosErrorMessage(axiosError)).toBe('API error field');
    });

    it('should return status message when no data message', () => {
      const axiosError = {
        response: {
          status: 404
        }
      };
      expect(getAxiosErrorMessage(axiosError)).toBe('Request failed with status 404');
    });

    it('should fall back to getErrorMessage for non-axios errors', () => {
      expect(getAxiosErrorMessage(new Error('Regular error'))).toBe('Regular error');
      expect(getAxiosErrorMessage('String error')).toBe('String error');
    });
  });

  describe('logError', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalConsoleError = console.error;

    beforeEach(() => {
      console.error = jest.fn();
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      console.error = originalConsoleError;
    });

    it('should log errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      
      logError(error, 'TestContext');
      
      expect(console.error).toHaveBeenCalledWith('[TestContext]:', error);
    });

    it('should use default context when not provided', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      
      logError(error);
      
      expect(console.error).toHaveBeenCalledWith('[Error]:', error);
    });

    it('should not log errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      
      logError(error, 'TestContext');
      
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});