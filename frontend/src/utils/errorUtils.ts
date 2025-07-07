// Error handling utilities

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

export function isAxiosError(error: unknown): error is { response?: { data?: { message?: string; error?: string }; status?: number } } {
  return !!(error && typeof error === 'object' && 'response' in error);
}

export function getAxiosErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.response?.status) {
      return `Request failed with status ${error.response.status}`;
    }
  }
  return getErrorMessage(error);
}

export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'Error'}]:`, error);
  }
  // In production, you might want to send to a logging service
}