import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAxiosErrorMessage } from '../utils/errorUtils';

class GitLabClient {
  private client: AxiosInstance;

  constructor() {
    // In production, use empty string for relative URLs
    const apiUrl = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:4050');
    this.client = axios.create({
      baseURL: `${apiUrl}/api/gitlab`,
      withCredentials: true,
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = getAxiosErrorMessage(error);
        return Promise.reject(new Error(message));
      }
    );
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }

  async post<T, D = unknown>(path: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }

  async put<T, D = unknown>(path: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(path, data, config);
    return response.data;
  }

  async delete(path: string, config?: AxiosRequestConfig): Promise<void> {
    await this.client.delete(path, config);
  }

  async patch<T, D = unknown>(path: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(path, data, config);
    return response.data;
  }
}

export const gitLabClient = new GitLabClient();