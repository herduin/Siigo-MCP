import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import logger from '../utils/logger.js';

export function registerTaxTools(tools: Map<string, any>, client: SiigoClient) {
  // List taxes
  tools.set('siigo_list_taxes', {
    name: 'siigo_list_taxes',
    description:
      'List all tax types configured in Siigo. Returns tax definitions with percentages and descriptions. Essential for AI agents working with invoicing and pricing.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing taxes');

      const result = await client.get(SIIGO_ENDPOINTS.TAXES);
      return {
        success: true,
        data: result,
      };
    },
  });

  // List document types
  tools.set('siigo_list_document_types', {
    name: 'siigo_list_document_types',
    description:
      'List all document types available in Siigo (invoices, credit notes, purchase orders, etc.). Returns document type catalog for AI agents to understand available transaction types.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing document types');

      const result = await client.get(SIIGO_ENDPOINTS.DOCUMENT_TYPES);
      return {
        success: true,
        data: result,
      };
    },
  });

  // List payment methods
  tools.set('siigo_list_payment_methods', {
    name: 'siigo_list_payment_methods',
    description:
      'List all payment methods configured in Siigo (cash, credit card, bank transfer, etc.). Returns payment method catalog for invoicing and payment processing.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing payment methods');

      const result = await client.get(SIIGO_ENDPOINTS.PAYMENT_TYPES);
      return {
        success: true,
        data: result,
      };
    },
  });

  // List cost centers
  tools.set('siigo_list_cost_centers', {
    name: 'siigo_list_cost_centers',
    description:
      'List all cost centers configured in Siigo. Returns cost center catalog for expense tracking and reporting. Useful for AI agents doing financial analysis.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing cost centers');

      const result = await client.get(SIIGO_ENDPOINTS.COST_CENTERS);
      return {
        success: true,
        data: result,
      };
    },
  });

  // List sellers
  tools.set('siigo_list_sellers', {
    name: 'siigo_list_sellers',
    description:
      'List all sellers/sales representatives in Siigo. Returns seller catalog for sales tracking and commission calculations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      logger.info('Listing sellers');

      // Note: Sellers may be under a different endpoint or may need special handling
      const result = await client.get('/v1/users?type=seller');
      return {
        success: true,
        data: result,
      };
    },
  });
}
