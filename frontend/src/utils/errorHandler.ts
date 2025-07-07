import axios, { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: unknown;
}

interface GitLabApiError {
  message?: string;
  error?: string;
  error_description?: string;
  errors?: Record<string, string[]>;
}

export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<GitLabApiError>;
    
    // Handle specific GitLab API error formats
    if (axiosError.response) {
      const { status, data } = axiosError.response;
      
      // GitLab API error format
      if (data?.message) {
        return {
          message: data.message,
          statusCode: status,
          details: data,
        };
      }
      
      // GitLab validation errors
      if (data?.error) {
        return {
          message: data.error,
          statusCode: status,
          details: data,
        };
      }
      
      // GitLab form errors
      if (data?.errors) {
        const errorMessages = Object.entries(data.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        return {
          message: errorMessages,
          statusCode: status,
          details: data.errors,
        };
      }
      
      // Common HTTP status messages
      switch (status) {
        case 401:
          return { message: 'Unauthorized. Please check your GitLab token.', statusCode: status };
        case 403:
          return { message: 'Forbidden. You don\'t have permission to perform this action.', statusCode: status };
        case 404:
          return { message: 'Resource not found.', statusCode: status };
        case 409:
          return { message: 'Conflict. The resource already exists.', statusCode: status };
        case 422:
          return { message: 'Validation failed. Please check your input.', statusCode: status };
        case 429:
          return { message: 'Too many requests. Please try again later.', statusCode: status };
        case 500:
          return { message: 'Internal server error. Please try again later.', statusCode: status };
        default:
          return { message: `Request failed with status ${status}`, statusCode: status };
      }
    } else if (axiosError.request) {
      // Request was made but no response received
      return { message: 'No response from server. Please check your connection.' };
    } else {
      // Error in request configuration
      return { message: axiosError.message };
    }
  }
  
  // Non-Axios errors
  if (error instanceof Error) {
    return { message: error.message };
  }
  
  return { message: 'An unexpected error occurred' };
};

export const getErrorMessage = (error: unknown): string => {
  return handleApiError(error).message;
};