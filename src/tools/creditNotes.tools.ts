import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listCreditNotesSchema, getCreditNoteSchema } from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerCreditNoteTools(tools: Map<string, any>, client: SiigoClient) {
  // List credit notes
  tools.set('siigo_list_credit_notes', {
    name: 'siigo_list_credit_notes',
    description:
      'List credit notes issued to customers. Returns paginated credit notes with customer info, amounts, and related invoices. Can filter by date range and customer.',
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
      const params = validateInput(listCreditNotesSchema, args);
      logger.info({ params }, 'Listing credit notes');

      const result = await client.get(SIIGO_ENDPOINTS.CREDIT_NOTES, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get credit note by ID
  tools.set('siigo_get_credit_note', {
    name: 'siigo_get_credit_note',
    description:
      'Get detailed information about a specific credit note by ID. Returns complete credit note details including line items and related invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Credit note ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getCreditNoteSchema, args);
      logger.info({ creditNoteId: id }, 'Getting credit note');

      const result = await client.get(SIIGO_ENDPOINTS.CREDIT_NOTE(id));
      return {
        success: true,
        data: result,
      };
    },
  });
}
