import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import logger from '../utils/logger.js';

export function registerUserTools(tools: Map<string, any>, client: SiigoClient) {
  // List users
  tools.set('siigo_list_users', {
    name: 'siigo_list_users',
    description:
      'List all users in the Siigo account. Returns users with their roles, permissions, and contact information. Useful for AI agents managing access and permissions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing users');

      const result = await client.get(SIIGO_ENDPOINTS.USERS);
      return {
        success: true,
        data: result,
      };
    },
  });
}
