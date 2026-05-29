import { SiigoClient } from '../siigo/siigoClient.js';
import { SIIGO_ENDPOINTS } from '../siigo/endpoints.js';
import { validateInput } from '../utils/validation.js';
import {
  listVouchersSchema,
  getVoucherSchema,
  listPaymentReceiptsSchema,
  getPaymentReceiptSchema,
  listReceivablesSchema,
  receivablesByCustomerSchema,
} from '../schemas/siigo.schemas.js';
import {
  paginated,
  single,
  voucherSchema,
  paymentReceiptSchema,
  invoiceSchema,
} from '../schemas/output.schemas.js';
import logger from '../utils/logger.js';

const dateRangeProps = {
  created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
  created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
  updated_start: { type: 'string', description: 'Fecha de última modificación >= (YYYY-MM-DD).' },
  updated_end: { type: 'string', description: 'Fecha de última modificación <= (YYYY-MM-DD).' },
};

const pageProps = {
  page: { type: 'number', description: 'Número de página (default: 1).' },
  page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
};

export function registerPaymentTools(tools: Map<string, any>, client: SiigoClient) {
  // --- Recibos de caja (pagos recibidos de clientes) ---
  tools.set('siigo_list_vouchers', {
    name: 'siigo_list_vouchers',
    description:
      'Lista recibos de caja (pagos recibidos de clientes) de Siigo (paginado). Filtros por fecha de creación/actualización. SALIDA: objeto paginado con results[] de recibos de caja (number, date, customer, payment, balance, items con facturas abonadas).',
    inputSchema: {
      type: 'object',
      properties: { ...pageProps, ...dateRangeProps },
    },
    outputSchema: paginated(voucherSchema),
    handler: async (args: any) => {
      const params = validateInput(listVouchersSchema, args);
      logger.info({ params }, 'Listing vouchers');
      const result = await client.get(SIIGO_ENDPOINTS.VOUCHERS, { params });
      return { success: true, data: result };
    },
  });

  tools.set('siigo_get_voucher', {
    name: 'siigo_get_voucher',
    description:
      'Obtiene un recibo de caja por su ID (GUID). SALIDA: recibo completo con document, number, date, type, customer, payment, items[] (facturas abonadas) y balance.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del recibo de caja.' } },
      required: ['id'],
    },
    outputSchema: single(voucherSchema, 'Recibo de caja.'),
    handler: async (args: any) => {
      const { id } = validateInput(getVoucherSchema, args);
      logger.info({ voucherId: id }, 'Getting voucher');
      const result = await client.get(SIIGO_ENDPOINTS.VOUCHER(id));
      return { success: true, data: result };
    },
  });

  // --- Recibos de pago/egreso (pagos realizados a proveedores) ---
  tools.set('siigo_list_payment_receipts', {
    name: 'siigo_list_payment_receipts',
    description:
      'Lista recibos de pago/egreso (pagos realizados a proveedores) de Siigo (paginado). Filtros por fecha de creación/actualización. SALIDA: objeto paginado con results[] de recibos de pago/egreso.',
    inputSchema: {
      type: 'object',
      properties: { ...pageProps, ...dateRangeProps },
    },
    outputSchema: paginated(paymentReceiptSchema),
    handler: async (args: any) => {
      const params = validateInput(listPaymentReceiptsSchema, args);
      logger.info({ params }, 'Listing payment receipts');
      const result = await client.get(SIIGO_ENDPOINTS.PAYMENT_RECEIPTS, { params });
      return { success: true, data: result };
    },
  });

  tools.set('siigo_get_payment_receipt', {
    name: 'siigo_get_payment_receipt',
    description:
      'Obtiene un recibo de pago/egreso por su ID (GUID). SALIDA: recibo completo con document, number, date, type, supplier, payment, items[] y balance.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID (GUID) del recibo de pago/egreso.' } },
      required: ['id'],
    },
    outputSchema: single(paymentReceiptSchema, 'Recibo de pago/egreso.'),
    handler: async (args: any) => {
      const { id } = validateInput(getPaymentReceiptSchema, args);
      logger.info({ paymentReceiptId: id }, 'Getting payment receipt');
      const result = await client.get(SIIGO_ENDPOINTS.PAYMENT_RECEIPT(id));
      return { success: true, data: result };
    },
  });

  // --- Cuentas por cobrar (derivadas de facturas con saldo pendiente) ---
  tools.set('siigo_list_receivables', {
    name: 'siigo_list_receivables',
    description:
      'Lista cuentas por cobrar: facturas con saldo pendiente (balance > 0). Siigo no expone un filtro de saldo, por lo que el MCP lista facturas (con filtros de fecha opcionales) y filtra en memoria las de balance > 0 de la página obtenida. SALIDA: objeto paginado con results[] de facturas con balance > 0. NOTA: el filtrado aplica solo a la página solicitada; usa created_start/created_end para acotar.',
    inputSchema: {
      type: 'object',
      properties: { ...pageProps, ...dateRangeProps },
    },
    outputSchema: paginated(invoiceSchema),
    handler: async (args: any) => {
      const params = validateInput(listReceivablesSchema, args);
      logger.info({ params }, 'Listing receivables');
      const result: any = await client.get(SIIGO_ENDPOINTS.INVOICES, { params });
      if (result && Array.isArray(result.results)) {
        result.results = result.results.filter((inv: any) => (inv.balance ?? 0) > 0);
      }
      return { success: true, data: result };
    },
  });

  tools.set('siigo_list_accounts_receivable_by_customer', {
    name: 'siigo_list_accounts_receivable_by_customer',
    description:
      'Lista las cuentas por cobrar (facturas con saldo pendiente) de un cliente específico, identificado por su número de identificación. El MCP filtra por customer_identification y deja solo las facturas con balance > 0 de la página obtenida. SALIDA: objeto paginado con results[] de facturas con balance > 0 del cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_identification: { type: 'string', description: 'Número de identificación del cliente.' },
        ...pageProps,
      },
      required: ['customer_identification'],
    },
    outputSchema: paginated(invoiceSchema),
    handler: async (args: any) => {
      const params = validateInput(receivablesByCustomerSchema, args);
      logger.info({ params }, 'Listing customer receivables');
      const result: any = await client.get(SIIGO_ENDPOINTS.INVOICES, { params });
      if (result && Array.isArray(result.results)) {
        result.results = result.results.filter((inv: any) => (inv.balance ?? 0) > 0);
      }
      return { success: true, data: result };
    },
  });
}
