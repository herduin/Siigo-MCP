import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import { listCreditNotesSchema, getCreditNoteSchema } from '../schemas/siigo.schemas.js';
import { paginated, single, creditNoteSchema } from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

export function registerCreditNoteTools(tools: Map<string, any>, client: SiigoClient) {
  // List credit notes
  tools.set('siigo_list_credit_notes', {
    name: 'siigo_list_credit_notes',
    description:
      'Lista notas crédito de Siigo (paginado). Filtros por fecha de creación (created_start/created_end) y última modificación (updated_start/updated_end). SALIDA: objeto paginado con results[] de notas crédito (number, date, invoice asociada, customer, items, total).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
        created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
        created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
        updated_start: { type: 'string', description: 'Fecha de última modificación >= (YYYY-MM-DD).' },
        updated_end: { type: 'string', description: 'Fecha de última modificación <= (YYYY-MM-DD).' },
      },
    },
    outputSchema: paginated(creditNoteSchema),
    handler: async (args: any) => {
      const params = validateInput(listCreditNotesSchema, args);
      logger.info({ params }, 'Listing credit notes');
      const result = await client.get(SIIGO_ENDPOINTS.CREDIT_NOTES, { params });
      return { success: true, data: result };
    },
  });

  // Get credit note by ID
  tools.set('siigo_get_credit_note', {
    name: 'siigo_get_credit_note',
    description:
      'Obtiene una nota crédito por su ID (GUID). SALIDA: nota crédito completa con document, number, date, invoice (factura aplicada), customer, items[], total y metadata.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la nota crédito.' } },
      required: ['id'],
    },
    outputSchema: single(creditNoteSchema, 'Nota crédito.'),
    handler: async (args: any) => {
      const { id } = validateInput(getCreditNoteSchema, args);
      logger.info({ creditNoteId: id }, 'Getting credit note');
      const result = await client.get(SIIGO_ENDPOINTS.CREDIT_NOTE(id));
      return { success: true, data: result };
    },
  });
}
