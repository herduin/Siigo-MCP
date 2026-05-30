import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import {
  listSupportDocumentsSchema,
  idParamSchema,
  createSupportDocumentSchema,
  updateSupportDocumentSchema,
} from '../schemas/siigo.schemas.js';
import { paginated, single, supportDocumentSchema } from '../schemas/output.schemas.js';
import { RO, WRITE, DESTRUCTIVE, pageProps, createdRangeProps, run } from './_helpers.js';

export function registerSupportDocumentTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  tools.set('siigo_list_support_documents', {
    name: 'siigo_list_support_documents',
    description:
      'Lista documentos soporte de compra a no obligados a facturar (paginado). Filtros por fecha de creación/actualización. SALIDA: objeto paginado con results[] de documentos soporte (supplier, total, balance, items).',
    inputSchema: { type: 'object', properties: { ...pageProps, ...createdRangeProps } },
    outputSchema: paginated(supportDocumentSchema),
    annotations: RO,
    handler: (args: any) =>
      run(listSupportDocumentsSchema, args, 'Listing support documents', (p) =>
        client.get(SIIGO_ENDPOINTS.SUPPORT_DOCS, { params: p })
      ),
  });

  tools.set('siigo_get_support_document', {
    name: 'siigo_get_support_document',
    description:
      'Obtiene un documento soporte por su ID (GUID). SALIDA: documento soporte completo con supplier, items[], total, balance.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del documento soporte.' } },
      required: ['id'],
    },
    outputSchema: single(supportDocumentSchema, 'Documento soporte.'),
    annotations: RO,
    handler: (args: any) =>
      run(idParamSchema, args, 'Getting support document', ({ id }) =>
        client.get(SIIGO_ENDPOINTS.SUPPORT_DOC(id))
      ),
  });

  if (!enableWrite) return;

  tools.set('siigo_create_support_document', {
    name: 'siigo_create_support_document',
    description:
      'Crea un documento soporte (compra a no obligados a facturar). Recibe el objeto `support_document` con la estructura del blueprint (document.id, supplier, items[], payments[]). SALIDA: documento soporte creado. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        support_document: {
          type: 'object',
          description: 'Datos del documento soporte (ver siigoapi.apib).',
        },
      },
      required: ['support_document'],
    },
    outputSchema: single(supportDocumentSchema, 'Documento soporte creado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createSupportDocumentSchema, args, 'Creating support document', ({ support_document }) =>
        client.post(SIIGO_ENDPOINTS.SUPPORT_DOCS, support_document)
      ),
  });

  tools.set('siigo_update_support_document', {
    name: 'siigo_update_support_document',
    description:
      'Actualiza un documento soporte existente. Recibe el ID (GUID) y el objeto `support_document` con los datos a actualizar. SALIDA: documento soporte actualizado. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) del documento soporte.' },
        support_document: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'support_document'],
    },
    outputSchema: single(supportDocumentSchema, 'Documento soporte actualizado.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(
        updateSupportDocumentSchema,
        args,
        'Updating support document',
        ({ id, support_document }) =>
          client.put(SIIGO_ENDPOINTS.SUPPORT_DOC(id), support_document)
      ),
  });

  tools.set('siigo_delete_support_document', {
    name: 'siigo_delete_support_document',
    description:
      'Elimina un documento soporte por su ID (GUID). Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del documento soporte.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting support document', ({ id }) =>
        client.delete(SIIGO_ENDPOINTS.SUPPORT_DOC(id))
      ),
  });
}
