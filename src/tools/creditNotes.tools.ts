import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listCreditNotesSchema,
  getCreditNoteSchema,
  createCreditNoteSchema,
  idParamSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, envelope, creditNoteSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, run } from './_helpers.js';
import logger from '../utils/logger.js';

export function registerCreditNoteTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
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

  // Get credit note PDF
  tools.set('siigo_get_credit_note_pdf', {
    name: 'siigo_get_credit_note_pdf',
    description:
      'Obtiene el PDF de una nota crédito por su ID. SALIDA: data con el contenido del PDF en base64 (campo base64) según devuelve Siigo.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la nota crédito.' } },
      required: ['id'],
    },
    outputSchema: envelope(
      { type: 'object', properties: { base64: { type: 'string', description: 'PDF codificado en base64.' } } },
      'PDF de la nota crédito.'
    ),
    annotations: RO,
    handler: (args: any) =>
      run(idParamSchema, args, 'Getting credit note PDF', ({ id }) =>
        client.get(SIIGO_ENDPOINTS.CREDIT_NOTE_PDF(id))
      ),
  });

  if (!enableWrite) return;

  // Create credit note
  tools.set('siigo_create_credit_note', {
    name: 'siigo_create_credit_note',
    description:
      'Crea una nota crédito (NC). Recibe el objeto `credit_note` con la estructura del API (document.id, invoice, customer, items[], etc.). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { credit_note: { type: 'object', description: 'Datos de la nota crédito (ver siigoapi.apib).' } },
      required: ['credit_note'],
    },
    outputSchema: single(creditNoteSchema, 'Nota crédito creada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createCreditNoteSchema, args, 'Creating credit note', ({ credit_note }) =>
        client.post(SIIGO_ENDPOINTS.CREDIT_NOTES, credit_note)
      ),
  });
}
