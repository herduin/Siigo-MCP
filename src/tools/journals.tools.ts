import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listJournalsSchema, getJournalSchema } from '../schemas/siigo.schemas.js';
import logger from '../utils/logger.js';

export function registerJournalTools(tools: Map<string, any>, client: SiigoClient) {
  // List journal entries
  tools.set('siigo_list_journal_entries', {
    name: 'siigo_list_journal_entries',
    description:
      'List accounting journal entries. Returns paginated journal entries with debits, credits, and account details. Can filter by date range. Essential for AI agents doing accounting analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pageSize: { type: 'number', description: 'Items per page (default: 20, max: 100)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
    handler: async (args: any) => {
      const params = validateInput(listJournalsSchema, args);
      logger.info({ params }, 'Listing journal entries');

      const result = await client.get(SIIGO_ENDPOINTS.JOURNALS, { params });
      return {
        success: true,
        data: result,
      };
    },
  });

  // Get journal entry by ID
  tools.set('siigo_get_journal_entry', {
    name: 'siigo_get_journal_entry',
    description:
      'Get detailed information about a specific journal entry by ID. Returns complete journal entry with all debit and credit lines.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Journal entry ID' },
      },
      required: ['id'],
    },
    handler: async (args: any) => {
      const { id } = validateInput(getJournalSchema, args);
      logger.info({ journalId: id }, 'Getting journal entry');

      const result = await client.get(SIIGO_ENDPOINTS.JOURNAL(id));
      return {
        success: true,
        data: result,
      };
    },
  });
}
