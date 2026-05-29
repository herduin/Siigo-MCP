import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Debe tener formato YYYY-MM-DD');

// Paginación estándar de Siigo (los nombres de query reales son `page` y `page_size`)
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(25),
});

// Filtros de fecha por fecha de creación / última actualización (formato YYYY-MM-DD)
export const createdRangeSchema = z.object({
  created_start: dateString.optional(),
  created_end: dateString.optional(),
  updated_start: dateString.optional(),
  updated_end: dateString.optional(),
});

export const idSchema = z.object({
  id: z.string().min(1),
});

// Raw request schema
export const rawRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  endpoint: z.string().min(1),
  data: z.any().optional(),
  params: z.record(z.string()).optional(),
});

export { dateString };
