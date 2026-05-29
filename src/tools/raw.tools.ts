import { SiigoClient } from '../siigo/siigoClient.js';
import { validateInput } from '../utils/validation.js';
import { rawRequestSchema } from '../schemas/common.schemas.js';
import { envelope } from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

export function registerRawTools(tools: Map<string, any>, client: SiigoClient) {
  // Health check
  tools.set('siigo_health_check', {
    name: 'siigo_health_check',
    description:
      'Verifica la conectividad y autenticación con la API de Siigo. Sin parámetros. SALIDA: { apiAvailable, authentication: { hasToken, expiresIn, isExpired }, timestamp }. Úsala para diagnosticar problemas de conexión.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        apiAvailable: { type: 'boolean', description: 'Si la API de Siigo respondió.' },
        authentication: { type: 'object', description: 'Estado del token (hasToken, expiresIn, isExpired).' },
        timestamp: { type: 'string', description: 'Marca de tiempo ISO 8601.' },
      },
    }),
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
      'Obtiene el estado del token de autenticación actual (incluye expiración). Sin parámetros. SALIDA: { hasToken, expiresIn, isExpired, timestamp }.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: envelope({
      type: 'object',
      properties: {
        hasToken: { type: 'boolean' },
        expiresIn: { type: ['number', 'null'], description: 'Segundos hasta expirar.' },
        isExpired: { type: 'boolean' },
        timestamp: { type: 'string' },
      },
    }),
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
      'Hace una petición HTTP cruda a cualquier endpoint de la API de Siigo. Da flexibilidad para acceder a endpoints no cubiertos por tools específicas (recuerda los nombres reales de Siigo: page_size, created_start, etc.). SALIDA: { success, data } con la respuesta cruda del endpoint, o { success:false, error }.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'Método HTTP.' },
        endpoint: { type: 'string', description: 'Ruta del endpoint (ej. /v1/customers).' },
        data: { type: 'object', description: 'Cuerpo de la petición (para POST/PUT).' },
        params: { type: 'object', description: 'Parámetros de query (usa los nombres reales de Siigo).' },
      },
      required: ['method', 'endpoint'],
    },
    outputSchema: envelope(
      { description: 'Respuesta cruda del endpoint solicitado (estructura variable).' },
      'Respuesta cruda de Siigo.'
    ),
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
