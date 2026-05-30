import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import {
  listQuotationsSchema,
  idParamSchema,
  createQuotationSchema,
  updateQuotationSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, quotationSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, DESTRUCTIVE, pageProps, createdRangeProps, run } from './_helpers.js';

export function registerQuotationTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  tools.set('siigo_list_quotations', {
    name: 'siigo_list_quotations',
    description:
      'Lista cotizaciones de Siigo (paginado). Filtros por fecha de creación/actualización. SALIDA: objeto paginado con results[] de cotizaciones (customer, seller, total, items). Útil para revisar el embudo comercial.',
    inputSchema: { type: 'object', properties: { ...pageProps, ...createdRangeProps } },
    outputSchema: paginated(quotationSchema),
    annotations: RO,
    handler: (args: any) =>
      run(listQuotationsSchema, args, 'Listing quotations', (p) =>
        client.get(SIIGO_ENDPOINTS.QUOTATIONS, { params: p })
      ),
  });

  tools.set('siigo_get_quotation', {
    name: 'siigo_get_quotation',
    description:
      'Obtiene una cotización por su ID (GUID). SALIDA: cotización completa con customer, items[], total, seller.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la cotización.' } },
      required: ['id'],
    },
    outputSchema: single(quotationSchema, 'Cotización.'),
    annotations: RO,
    handler: (args: any) =>
      run(idParamSchema, args, 'Getting quotation', ({ id }) =>
        client.get(SIIGO_ENDPOINTS.QUOTATION(id))
      ),
  });

  if (!enableWrite) return;

  tools.set('siigo_create_quotation', {
    name: 'siigo_create_quotation',
    description:
      'Crea una cotización. Recibe el objeto `quotation` con la estructura del blueprint (document.id, customer, items[], seller). SALIDA: cotización creada. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        quotation: { type: 'object', description: 'Datos de la cotización (ver siigoapi.apib).' },
      },
      required: ['quotation'],
    },
    outputSchema: single(quotationSchema, 'Cotización creada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createQuotationSchema, args, 'Creating quotation', ({ quotation }) =>
        client.post(SIIGO_ENDPOINTS.QUOTATIONS, quotation)
      ),
  });

  tools.set('siigo_update_quotation', {
    name: 'siigo_update_quotation',
    description:
      'Actualiza una cotización existente. Recibe el ID (GUID) y el objeto `quotation` con los datos a actualizar. SALIDA: cotización actualizada. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la cotización.' },
        quotation: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'quotation'],
    },
    outputSchema: single(quotationSchema, 'Cotización actualizada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updateQuotationSchema, args, 'Updating quotation', ({ id, quotation }) =>
        client.put(SIIGO_ENDPOINTS.QUOTATION(id), quotation)
      ),
  });

  tools.set('siigo_delete_quotation', {
    name: 'siigo_delete_quotation',
    description:
      'Elimina una cotización por su ID (GUID). Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la cotización.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting quotation', ({ id }) =>
        client.delete(SIIGO_ENDPOINTS.QUOTATION(id))
      ),
  });
}
