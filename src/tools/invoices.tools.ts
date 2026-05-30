import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listInvoicesSchema,
  getInvoiceSchema,
  searchInvoicesSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  mailInvoiceSchema,
  batchInvoiceSchema,
  idParamSchema,
} from '../schemas/siigo.schemas.js';
import {
  paginated,
  single,
  envelope,
  arrayOf,
  invoiceSchema,
  genericObject,
} from '../schemas/output.schemas.js';
import { RO, WRITE, DESTRUCTIVE, run } from './_helpers.js';
import logger from '../utils/logger.js';

export function registerInvoiceTools(
  tools: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  client: SiigoClient,
  enableWrite = false
) {
  // List invoices
  tools.set('siigo_list_invoices', {
    name: 'siigo_list_invoices',
    description:
      'Lista facturas de venta de Siigo (paginado). Filtros por fecha de creación (created_start/created_end), última modificación (updated_start/updated_end), fecha de elaboración (date_start/date_end), nombre del documento (name, ej. FV-003-457), identificación del cliente (customer_identification) y document_id. SALIDA: objeto paginado con results[] de facturas (cada una con total, balance/saldo pendiente, items, payments, customer).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
        created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
        created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
        updated_start: { type: 'string', description: 'Fecha de última modificación >= (YYYY-MM-DD).' },
        updated_end: { type: 'string', description: 'Fecha de última modificación <= (YYYY-MM-DD).' },
        date_start: { type: 'string', description: 'Fecha de elaboración >= (YYYY-MM-DD).' },
        date_end: { type: 'string', description: 'Fecha de elaboración <= (YYYY-MM-DD).' },
        name: { type: 'string', description: 'Nombre del documento, ej. FV-003-457.' },
        customer_identification: { type: 'string', description: 'Identificación del cliente.' },
        customer_branch_office: { type: 'number', description: 'Sucursal del cliente.' },
        document_id: { type: 'number', description: 'ID del tipo de comprobante.' },
      },
    },
    outputSchema: paginated(invoiceSchema),
    handler: async (args: any) => {
      const params = validateInput(listInvoicesSchema, args);
      logger.info({ params }, 'Listing invoices');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, { params });
      return { success: true, data: result };
    },
  });

  // Get invoice by ID
  tools.set('siigo_get_invoice', {
    name: 'siigo_get_invoice',
    description:
      'Obtiene una factura de venta por su ID (GUID). SALIDA: factura completa con document, number, name, date, customer, items[], payments[], total, balance (saldo pendiente), seller, public_url y metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la factura.' },
      },
      required: ['id'],
    },
    outputSchema: single(invoiceSchema, 'Factura de venta.'),
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE(id));
      return { success: true, data: result };
    },
  });

  // Search invoices (por filtros reales soportados por Siigo)
  tools.set('siigo_search_invoices', {
    name: 'siigo_search_invoices',
    description:
      'Busca facturas por los filtros soportados por Siigo: name (ej. FV-003-457), customer_identification (identificación del cliente) o document_id. NO es búsqueda full-text. SALIDA: objeto paginado con results[] de facturas.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del documento, ej. FV-003-457.' },
        customer_identification: { type: 'string', description: 'Identificación del cliente.' },
        document_id: { type: 'number', description: 'ID del tipo de comprobante.' },
        page: { type: 'number', description: 'Número de página (default: 1).' },
        page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
      },
    },
    outputSchema: paginated(invoiceSchema),
    handler: async (args: any) => {
      const params = validateInput(searchInvoicesSchema, args);
      logger.info({ params }, 'Searching invoices');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICES, { params });
      return { success: true, data: result };
    },
  });

  // Get invoice PDF
  tools.set('siigo_get_invoice_pdf', {
    name: 'siigo_get_invoice_pdf',
    description:
      'Obtiene el PDF de una factura de venta por su ID. SALIDA: data con el contenido del PDF en base64 (campo base64) según devuelve Siigo.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la factura.' },
      },
      required: ['id'],
    },
    outputSchema: envelope(
      { type: 'object', properties: { base64: { type: 'string', description: 'PDF codificado en base64.' } } },
      'PDF de la factura.'
    ),
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice PDF');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE_PDF(id));
      return { success: true, data: result };
    },
  });

  // Get invoice XML
  tools.set('siigo_get_invoice_xml', {
    name: 'siigo_get_invoice_xml',
    description:
      'Obtiene el XML de la factura electrónica (sello DIAN) por su ID. SALIDA: data con el XML de la factura electrónica.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la factura.' },
      },
      required: ['id'],
    },
    outputSchema: envelope(
      { type: 'object', description: 'XML de la factura electrónica.' },
      'XML del documento electrónico (sello DIAN).'
    ),
    handler: async (args: any) => {
      const { id } = validateInput(getInvoiceSchema, args);
      logger.info({ invoiceId: id }, 'Getting invoice XML');

      const result = await client.get(SIIGO_ENDPOINTS.INVOICE_XML(id));
      return { success: true, data: result };
    },
  });

  // Get invoice stamp errors (errores de timbrado/DIAN)
  tools.set('siigo_get_invoice_stamp_errors', {
    name: 'siigo_get_invoice_stamp_errors',
    description:
      'Obtiene los errores de timbrado/sello electrónico (DIAN) de una factura por su ID. SALIDA: data con el detalle de los errores reportados por la DIAN para el documento electrónico.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la factura.' } },
      required: ['id'],
    },
    outputSchema: arrayOf(genericObject, 'Errores de timbrado de la factura electrónica.'),
    annotations: RO,
    handler: (args: any) =>
      run(idParamSchema, args, 'Getting invoice stamp errors', ({ id }) =>
        client.get(SIIGO_ENDPOINTS.INVOICE_STAMP_ERRORS(id))
      ),
  });

  if (!enableWrite) return;

  // Create invoice
  tools.set('siigo_create_invoice', {
    name: 'siigo_create_invoice',
    description:
      'Crea una factura de venta (FV). Recibe el objeto `invoice` con la estructura del API (document.id, date, customer, items[], payments[], etc.). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { invoice: { type: 'object', description: 'Datos de la factura (ver siigoapi.apib).' } },
      required: ['invoice'],
    },
    outputSchema: single(invoiceSchema, 'Factura creada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(createInvoiceSchema, args, 'Creating invoice', ({ invoice }) =>
        client.post(SIIGO_ENDPOINTS.INVOICES, invoice)
      ),
  });

  // Update invoice
  tools.set('siigo_update_invoice', {
    name: 'siigo_update_invoice',
    description: 'Actualiza una factura de venta existente por su ID. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la factura.' },
        invoice: { type: 'object', description: 'Datos a actualizar.' },
      },
      required: ['id', 'invoice'],
    },
    outputSchema: single(invoiceSchema, 'Factura actualizada.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(updateInvoiceSchema, args, 'Updating invoice', ({ id, invoice }) =>
        client.put(SIIGO_ENDPOINTS.INVOICE(id), invoice)
      ),
  });

  // Delete invoice
  tools.set('siigo_delete_invoice', {
    name: 'siigo_delete_invoice',
    description: 'Elimina una factura de venta. Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la factura.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Deleting invoice', ({ id }) => client.delete(SIIGO_ENDPOINTS.INVOICE(id))),
  });

  // Annul invoice
  tools.set('siigo_annul_invoice', {
    name: 'siigo_annul_invoice',
    description:
      'Anula una factura de venta por su ID (no la elimina, la marca como anulada). Operación destructiva. Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) de la factura.' } },
      required: ['id'],
    },
    annotations: DESTRUCTIVE,
    handler: (args: any) =>
      run(idParamSchema, args, 'Annulling invoice', ({ id }) => client.post(SIIGO_ENDPOINTS.INVOICE_ANNUL(id))),
  });

  // Send invoice email
  tools.set('siigo_send_invoice_email', {
    name: 'siigo_send_invoice_email',
    description:
      'Envía por correo electrónico una factura de venta. Recibe el ID de la factura y opcionalmente mail_to (destinatario) y copy_to (copia). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID (GUID) de la factura.' },
        mail_to: { type: 'string', description: 'Correo destinatario (opcional).' },
        copy_to: { type: 'string', description: 'Correo en copia (opcional).' },
      },
      required: ['id'],
    },
    outputSchema: envelope({ type: 'object', description: 'Resultado del envío.' }, 'Resultado del envío del correo.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(mailInvoiceSchema, args, 'Sending invoice email', ({ id, mail_to, copy_to }) =>
        client.post(SIIGO_ENDPOINTS.INVOICE_MAIL(id), { mail_to, copy_to })
      ),
  });

  // Create invoice batch
  tools.set('siigo_create_invoice_batch', {
    name: 'siigo_create_invoice_batch',
    description:
      'Crea facturas de venta en lote. Recibe el objeto `batch` con la estructura del API (lista de facturas a procesar). Requiere ENABLE_WRITE_TOOLS.',
    inputSchema: {
      type: 'object',
      properties: { batch: { type: 'object', description: 'Datos del lote de facturas (ver siigoapi.apib).' } },
      required: ['batch'],
    },
    outputSchema: envelope({ type: 'object', description: 'Resultado del procesamiento del lote.' }, 'Resultado del lote.'),
    annotations: WRITE,
    handler: (args: any) =>
      run(batchInvoiceSchema, args, 'Creating invoice batch', ({ batch }) =>
        client.post(SIIGO_ENDPOINTS.INVOICES_BATCH, batch)
      ),
  });
}
