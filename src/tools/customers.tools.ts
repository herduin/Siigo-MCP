import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listCustomersSchema,
  searchCustomersSchema,
  getCustomerSchema,
} from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerCustomerTools(
  tools: Map<string, any>,
  client: SiigoClient,
  _enableWrite: boolean
) {
  // List customers
  tools.set('siigo_list_customers', {
    name: 'siigo_list_customers',
    description:
      'List customers from Siigo. Returns paginated list of customers with their contact information, addresses, and fiscal responsibilities. Useful for AI agents to find customer data.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        active: { type: 'boolean', description: 'Filter by active status' },
        type: { type: 'string', enum: ['Customer', 'Supplier', 'Other'], description: 'Customer type filter' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(listCustomersSchema, args);
      logger.info({ params }, 'Listing customers');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMERS, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get customer by ID
  tools.set('siigo_get_customer', {
    name: 'siigo_get_customer',
    description:
      'Get detailed information about a specific customer by ID. Returns complete customer profile including contacts, addresses, fiscal information, and related users.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Customer ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getCustomerSchema, args);
      logger.info({ customerId: id }, 'Getting customer');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMER(id));
      return {
        success: true,
        data: result,
      };
    },
  });

  // Search customers
  tools.set('siigo_search_customers', {
    name: 'siigo_search_customers',
    description:
      'Search customers by name, identification, or email. Returns matching customers with pagination. Useful for AI agents to find customers based on partial information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (name, ID, or email)' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
      },
      required: ['query'],
    },
    handler: async (args: any) => {
      const params = validateInput(searchCustomersSchema, args);
      logger.info({ query: params.query }, 'Searching customers');

      const result = await client.get(SIIGO_ENDPOINTS.CUSTOMERS, {
        params: { ...params, search: params.query },
      });
      return {
        success: true,
        data: result,
      };
    },
  });
}
