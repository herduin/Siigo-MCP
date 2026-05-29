import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listPaymentsSchema, getPaymentSchema } from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerPaymentTools(tools: Map<string, any>, client: SiigoClient) {
  // List payments
  tools.set('siigo_list_payments', {
    name: 'siigo_list_payments',
    description:
      'List payments received from customers. Returns paginated payments with customer info, amount, and applied invoices. Can filter by date range and customer. Essential for AI agents tracking cash flow.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        customerId: { type: 'string', description: 'Filter by customer ID' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(listPaymentsSchema, args);
      logger.info({ params }, 'Listing payments');

      const result = await client.get(SIIGO_ENDPOINTS.PAYMENTS, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get payment by ID
  tools.set('siigo_get_payment', {
    name: 'siigo_get_payment',
    description:
      'Get detailed information about a specific payment by ID. Returns complete payment details including applied invoices and amounts.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Payment ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getPaymentSchema, args);
      logger.info({ paymentId: id }, 'Getting payment');

      const result = await client.get(SIIGO_ENDPOINTS.PAYMENT(id));
      return {
        success: true,
        data: result,
      };
    },
  });

  // List accounts receivable
  tools.set('siigo_list_receivables', {
    name: 'siigo_list_receivables',
    description:
      'List all outstanding accounts receivable (unpaid invoices). Returns invoices with pending balances grouped by customer. Critical for AI agents managing collections.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
      },
    },
    handler: async (args: any) => {
      logger.info({ params: args }, 'Listing receivables');

      // Get invoices with balance > 0
      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: { ...args, balance: '>0' },
      });
      return {
        success: true,
        data: result,
      };
    },
  });

  // List accounts receivable by customer
  tools.set('siigo_list_accounts_receivable_by_customer', {
    name: 'siigo_list_accounts_receivable_by_customer',
    description:
      'List accounts receivable for a specific customer. Returns all unpaid invoices for the customer with aging information. Essential for AI agents doing customer credit analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
      },
      required: ['customerId'],
    },
    handler: async (args: any) => {
      const { customerId } = args;
      logger.info({ customerId }, 'Listing customer receivables');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: { customerId, balance: '>0' },
      });
      return {
        success: true,
        data: result,
      };
    },
  });
}
