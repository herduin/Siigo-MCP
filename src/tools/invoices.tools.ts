import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listInvoicesSchema,
  getInvoiceSchema,
  searchInvoicesSchema,
} from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerInvoiceTools(
  tools: Map<string, any>,
  client: SiigoClient,
  _enableWrite: boolean
) {
  // List invoices
  tools.set('siigo_list_invoices', {
    name: 'siigo_list_invoices',
    description:
      'List invoices from Siigo. Returns paginated invoices with customer info, totals, items, and payment status. Can filter by date range and customer. Essential for AI agents analyzing sales and billing.',
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
      const params = validateInput(listInvoicesSchema, args);
      logger.info({ params }, 'Listing invoices');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get invoice by ID
  tools.set('siigo_get_invoice', {
    name: 'siigo_get_invoice',
    description:
      'Get detailed information about a specific invoice by ID. Returns complete invoice with line items, taxes, payments, and electronic stamp status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE(id));
      return {
        success: true,
        data: result,
      };
    },
  });

  // Search invoices
  tools.set('siigo_search_invoices', {
    name: 'siigo_search_invoices',
    description:
      'Search invoices by number, customer name, or reference. Returns matching invoices with pagination. Can filter by date range.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (invoice number or customer name)' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['query'],
    },
    handler: async (args: any) => {
      const params = validateInput(searchInvoicesSchema, args);
      logger.info({ query: params.query }, 'Searching invoices');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, {
        params: { ...params, search: params.query },
      });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get invoice PDF
  tools.set('siigo_get_invoice_pdf', {
    name: 'siigo_get_invoice_pdf',
    description:
      'Get PDF download URL for a specific invoice. Returns URL that can be used to download the invoice PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice PDF');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE_PDF(id));
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get invoice XML
  tools.set('siigo_get_invoice_xml', {
    name: 'siigo_get_invoice_xml',
    description:
      'Get electronic stamp information and XML for a specific invoice. Returns DIAN electronic invoice stamp details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice XML stamp');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE_XML(id));
      return {
        success: true,
        data: result,
      };
    },
  });
}
