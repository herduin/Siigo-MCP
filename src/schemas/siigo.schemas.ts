import { z } from 'zod';
import { paginationSchema, dateRangeSchema } from './common.schemas.js';

// Customer schemas
export const listCustomersSchema = z.object({
  ...paginationSchema.shape,
  active: z.boolean().optional(),
  type: z.enum(['Customer', 'Supplier', 'Other']).optional(),
});

export const searchCustomersSchema = z.object({
  query: z.string().min(1),
  ...paginationSchema.shape,
});

export const getCustomerSchema = z.object({
  id: z.string().min(1),
});

// Invoice schemas
export const listInvoicesSchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  customerId: z.string().optional(),
});

export const getInvoiceSchema = z.object({
  id: z.string().min(1),
});

export const searchInvoicesSchema = z.object({
  query: z.string().min(1),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

// Product schemas
export const listProductsSchema = z.object({
  ...paginationSchema.shape,
  active: z.boolean().optional(),
  type: z.string().optional(),
});

export const getProductSchema = z.object({
  id: z.string().min(1),
});

export const searchProductsSchema = z.object({
  query: z.string().min(1),
  ...paginationSchema.shape,
});

// Payment schemas
export const listPaymentsSchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  customerId: z.string().optional(),
});

export const getPaymentSchema = z.object({
  id: z.string().min(1),
});

// Credit Note schemas
export const listCreditNotesSchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
  customerId: z.string().optional(),
});

export const getCreditNoteSchema = z.object({
  id: z.string().min(1),
});

// Journal Entry schemas
export const listJournalsSchema = z.object({
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

export const getJournalSchema = z.object({
  id: z.string().min(1),
});

// Reports schemas
export const financialSummarySchema = z.object({
  ...dateRangeSchema.shape,
});

export const salesSummarySchema = z.object({
  ...dateRangeSchema.shape,
  groupBy: z.enum(['day', 'week', 'month']).optional().default('month'),
});

export const customerStatementSchema = z.object({
  customerId: z.string().min(1),
  ...dateRangeSchema.shape,
});

export const accountsReceivableAgingSchema = z.object({
  customerId: z.string().optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
