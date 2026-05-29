import { z } from 'zod';
import { paginationSchema, createdRangeSchema, dateString } from './common.schemas.js';

// ---------------------------------------------------------------------------
// Customers  (GET /v1/customers)
// Query reales: identification, branch_office, created_start/end, updated_start/end
// ---------------------------------------------------------------------------
export const listCustomersSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
  identification: z.string().optional(),
  branch_office: z.number().int().optional(),
});

// Siigo no ofrece búsqueda full-text en clientes; se filtra por identificación.
export const searchCustomersSchema = z.object({
  identification: z.string().min(1),
  ...paginationSchema.shape,
});

export const getCustomerSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Invoices  (GET /v1/invoices)
// Query reales: created_start/end, updated_start/end, date_start/end,
//               name, customer_identification, customer_branch_office, document_id
// ---------------------------------------------------------------------------
export const listInvoicesSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
  date_start: dateString.optional(),
  date_end: dateString.optional(),
  name: z.string().optional(),
  customer_identification: z.string().optional(),
  customer_branch_office: z.number().int().optional(),
  document_id: z.number().int().optional(),
});

export const getInvoiceSchema = z.object({
  id: z.string().min(1),
});

// Búsqueda de facturas por los filtros reales soportados por Siigo.
export const searchInvoicesSchema = z.object({
  name: z.string().optional(),
  customer_identification: z.string().optional(),
  document_id: z.number().int().optional(),
  ...paginationSchema.shape,
});

// ---------------------------------------------------------------------------
// Products  (GET /v1/products)
// Query reales: code, created_start/end, updated_start/end, id
// ---------------------------------------------------------------------------
export const listProductsSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
  code: z.string().optional(),
});

export const getProductSchema = z.object({
  id: z.string().min(1),
});

// Búsqueda de productos por código (único filtro de texto soportado).
export const searchProductsSchema = z.object({
  code: z.string().min(1),
  ...paginationSchema.shape,
});

// ---------------------------------------------------------------------------
// Vouchers — Recibos de caja  (GET /v1/vouchers)
// Payment receipts — Recibos de pago/egreso  (GET /v1/payment-receipts)
// Query reales: created_start/end, updated_start/end
// ---------------------------------------------------------------------------
export const listVouchersSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
});

export const getVoucherSchema = z.object({
  id: z.string().min(1),
});

export const listPaymentReceiptsSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
});

export const getPaymentReceiptSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Receivables (derivado de facturas con saldo pendiente)
// ---------------------------------------------------------------------------
export const listReceivablesSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
});

export const receivablesByCustomerSchema = z.object({
  customer_identification: z.string().min(1),
  ...paginationSchema.shape,
});

// ---------------------------------------------------------------------------
// Credit Notes  (GET /v1/credit-notes)
// Query reales: created_start/end, updated_start/end
// ---------------------------------------------------------------------------
export const listCreditNotesSchema = z.object({
  ...paginationSchema.shape,
  ...createdRangeSchema.shape,
});

export const getCreditNoteSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Journals — Comprobantes contables  (GET /v1/journals)
// Query reales: document_id  (+ paginación)
// ---------------------------------------------------------------------------
export const listJournalsSchema = z.object({
  ...paginationSchema.shape,
  document_id: z.number().int().optional(),
});

export const getJournalSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export const documentTypeValues = ['FV', 'NC', 'FC', 'DS', 'RC', 'RP', 'CC', 'C'] as const;

// GET /v1/document-types?type=FV
export const listDocumentTypesSchema = z.object({
  type: z.enum(documentTypeValues),
});

// GET /v1/payment-types?document_type=FV
export const listPaymentTypesSchema = z.object({
  document_type: z.enum(documentTypeValues),
});

// ---------------------------------------------------------------------------
// Reports (parámetros de conveniencia del MCP, no de Siigo)
// ---------------------------------------------------------------------------
const reportDateRange = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

export const financialSummarySchema = reportDateRange;

export const salesSummarySchema = z.object({
  ...reportDateRange.shape,
  groupBy: z.enum(['day', 'week', 'month']).optional().default('month'),
});

export const customerStatementSchema = z.object({
  customer_identification: z.string().min(1),
  ...reportDateRange.shape,
});

export const accountsReceivableAgingSchema = z.object({
  customer_identification: z.string().optional(),
  asOfDate: dateString.optional(),
});

export const monthlyRevenueReportSchema = z.object({
  months: z.number().int().min(1).max(36).default(12),
});
