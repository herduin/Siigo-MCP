import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listJournalsSchema, getJournalSchema, createJournalSchema } from '../schemas/siigo.schemas.js';
import { paginated, single, journalSchema } from '../schemas/output.schemas.js';
import { WRITE, run } from './_helpers.js';
import logger from '../utils/logger.js';

export function registerJournalTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  // List journal entries
  tools.set('siigo_list_journal_entries', {
    name: 'siigo_list_journal_entries',
    description:
      'Lista comprobantes contables de Siigo (paginado). Filtro opcional document_id (ID del tipo de comprobante). SALIDA: objeto paginado con results[] de comprobantes (number, date, items con movimientos débito/crédito por cuenta).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
        document_id: { type: 'number', description: 'ID del tipo de comprobante contable.' },
      },
    },
    outputSchema: paginated(journalSchema),
    handler: async (args: any) => {
      const params = validateInput(listJournalsSchema, args);
      logger.info({ params }, 'Listing journal entries');
      const result = await client.get(SIIGO_ENDPOINTS.JOURNALS, { params });
      return { success: true, data: result };
    },
  });

  // Get journal entry by ID
  tools.set('siigo_get_journal_entry', {
    name: 'siigo_get_journal_entry',
    description:
      'Obtiene un comprobante contable por su ID (GUID). SALIDA: comprobante completo con document, number, date e items[] (líneas débito/crédito por cuenta).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del comprobante contable.' } },
      required: ['id'],
    },
    outputSchema: single(journalSchema, 'Comprobante contable.'),
    handler: async (args: any) => {
      const { id } = validateInput(getJournalSchema, args);
      logger.info({ journalId: id }, 'Getting journal entry');
      const result = await client.get(SIIGO_ENDPOINTS.JOURNAL(id));
      return { success: true, data: result };
    },
  });

  if (!enableWrite) return;

  // Create journal entry (comprobante contable)
  tools.set('siigo_create_journal', {
    name: 'siigo_create_journal',
    description:
      'Crea un comprobante contable (CC). Recibe el objeto `journal` con la estructura del API (document.id, date, items[] con líneas débito/crédito por cuenta, etc.). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { journal: { type: 'object', description: 'Datos del comprobante contable (ver siigoapi.apib).' } },
      required: ['journal'],
    },
    outputSchema: single(journalSchema, 'Comprobante contable creado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createJournalSchema, args, 'Creating journal', ({ journal }) =>
        client.post(SIIGO_ENDPOINTS.JOURNALS, journal)
      ),
  });
}
