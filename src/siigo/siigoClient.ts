import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { SiigoAuth } from './siigoAuth.js';
import { withRetry } from '../utils/retries.js';
import logger from '../utils/logger.js';

export interface SiigoClientConfig {
  baseUrl: string;
  username: string;
  accessKey: string;
  partnerId?: string;
  timeoutMs: number;
  maxRetries: number;
}

export class SiigoClient {
  private readonly httpClient: AxiosInstance;
  private readonly auth: SiigoAuth;
  private readonly config: SiigoClientConfig;

  constructor(config: SiigoClientConfig) {
    this.config = config;
    this.auth = new SiigoAuth({
      username: config.username,
      accessKey: config.accessKey,
      baseUrl: config.baseUrl,
    });

    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(config.partnerId && { 'Partner-Id': config.partnerId }),
      },
    });

    // Add request interceptor to inject auth token
    this.httpClient.interceptors.request.use(
      async (config) => {
        const token = await this.auth.getToken();
        config.headers.Authorization = token;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle auth errors
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and haven't retried auth yet
        if (error.response?.status === 401 && !originalRequest._authRetry) {
          originalRequest._authRetry = true;
          logger.info('Token expired - refreshing');

          try {
            await this.auth.refreshToken();
            const token = await this.auth.getToken();
            originalRequest.headers.Authorization = token;
            return this.httpClient(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const startTime = Date.now();

    try {
      const response = await withRetry<AxiosResponse<T>>(
        () => this.httpClient.request<T>(config),
        {
          maxRetries: this.config.maxRetries,
        }
      );

      const duration = Date.now() - startTime;
      logger.debug(
        {
          method: config.method,
          url: config.url,
          status: response.status,
          durationMs: duration,
        },
        'Siigo API request successful'
      );

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        {
          method: config.method,
          url: config.url,
          error: this.formatError(error),
          durationMs: duration,
        },
        'Siigo API request failed'
      );
      throw this.enhanceError(error);
    }
  }

  getTokenStatus() {
    return this.auth.getTokenStatus();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.auth.getToken();
      return true;
    } catch {
      return false;
    }
  }

  private formatError(error: unknown): any {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      };
    }
    return error;
  }

  private enhanceError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as any;

      if (data?.Message) {
        return new Error(`Siigo API Error: ${data.Message}`);
      }

      if (status === 401) {
        return new Error('Siigo authentication failed - check credentials');
      }

      if (status === 403) {
        return new Error('Siigo access forbidden - check permissions');
      }

      if (status === 404) {
        return new Error('Siigo resource not found');
      }

      if (status && status >= 500) {
        return new Error('Siigo API server error - try again later');
      }

      return new Error(`Siigo API Error: ${error.message}`);
    }

    return error as Error;
  }
}
