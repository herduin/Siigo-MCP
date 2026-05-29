import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger.js';
import type { SiigoAuthResponse } from './siigoTypes.js';

export interface SiigoAuthConfig {
  username: string;
  accessKey: string;
  baseUrl: string;
}

export class SiigoAuth {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly config: SiigoAuthConfig;
  private readonly httpClient: AxiosInstance;

  constructor(config: SiigoAuthConfig) {
    this.config = config;
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    logger.info('Obtaining new Siigo access token');

    try {
      const response = await this.httpClient.post<SiigoAuthResponse>(
        '/auth',
        {
          username: this.config.username,
          access_key: this.config.accessKey,
        }
      );

      this.token = response.data.access_token;
      // Set expiry to 90% of actual expiry time to refresh before it expires
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 * 0.9;

      logger.info('Siigo access token obtained successfully');
      return this.token;
    } catch (error) {
      logger.error({ error }, 'Failed to obtain Siigo access token');
      throw new Error('Failed to authenticate with Siigo API');
    }
  }

  async refreshToken(): Promise<string> {
    this.token = null;
    this.tokenExpiry = 0;
    return this.getToken();
  }

  getTokenStatus(): {
    hasToken: boolean;
    expiresIn: number | null;
    isExpired: boolean;
  } {
    if (!this.token) {
      return {
        hasToken: false,
        expiresIn: null,
        isExpired: true,
      };
    }

    const expiresIn = Math.max(0, this.tokenExpiry - Date.now());
    return {
      hasToken: true,
      expiresIn: Math.floor(expiresIn / 1000),
      isExpired: expiresIn <= 0,
    };
  }
}
