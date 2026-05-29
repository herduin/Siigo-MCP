import { SiigoClient } from '../siigo/siigoClient.js';
import { validateInput } from '../utils/validation.js';
import { rawRequestSchema } from '../schemas/common.schemas.js';
import logger from '../utils/logger.js';

export function registerRawTools(tools: Map<string, any>, client: SiigoClient) {
  // Health check
  tools.set('siigo_health_check', {
    name: 'siigo_health_check',
    description:
      'Check health and connectivity to Siigo API. Returns authentication status and API availability. Use this to diagnose connection issues.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Performing health check');

      try {
        const healthy = await client.healthCheck();
        const tokenStatus = client.getTokenStatus();

        return {
          success: true,
          data: {
            apiAvailable: healthy,
            authentication: tokenStatus,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          data: {
            apiAvailable: false,
            authentication: client.getTokenStatus(),
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
  });

  // Get token status
  tools.set('siigo_get_token_status', {
    name: 'siigo_get_token_status',
    description:
      'Get current authentication token status including expiration time. Useful for AI agents monitoring API connectivity.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Getting token status');

      const status = client.getTokenStatus();

      return {
        success: true,
        data: {
          ...status,
          timestamp: new Date().toISOString(),
        },
      };
    },
  });

  // Raw API request
  tools.set('siigo_raw_request', {
    name: 'siigo_raw_request',
    description:
      'Make a raw HTTP request to any Siigo API endpoint. Provides flexibility for AI agents to access endpoints not covered by specific tools. Use with caution - requires knowledge of Siigo API.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
        endpoint: { type: 'string', description: 'API endpoint path (e.g., /v1/customers)' },
        data: { type: 'object', description: 'Request body (for POST/PUT)' },
        params: { type: 'object', description: 'Query parameters' },
      },
      required: ['method', 'endpoint'],
    },
    handler: async (args: any) => {
      const params = validateInput(rawRequestSchema, args);
      logger.info({ method: params.method, endpoint: params.endpoint }, 'Making raw request');

      try {
        let result: any;

        switch (params.method) {
          case 'GET':
            result = await client.get(params.endpoint, { params: params.params });
            break;
          case 'POST':
            result = await client.post(params.endpoint, params.data, { params: params.params });
            break;
          case 'PUT':
            result = await client.put(params.endpoint, params.data, { params: params.params });
            break;
          case 'DELETE':
            result = await client.delete(params.endpoint, { params: params.params });
            break;
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error({ error, method: params.method, endpoint: params.endpoint }, 'Raw request failed');
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  });
}
