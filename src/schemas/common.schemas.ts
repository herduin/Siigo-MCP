import { z } from 'zod';

// Common pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  ...paginationSchema.shape,
});

export const idSchema = z.object({
  id: z.string().min(1),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Raw request schema
export const rawRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  endpoint: z.string().min(1),
  data: z.any().optional(),
  params: z.record(z.string()).optional(),
});
