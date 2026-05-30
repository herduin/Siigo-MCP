import { z } from 'zod';
import logger from './logger.js';

export class ValidationError extends Error {
  public errors: z.ZodError;

  constructor(message: string, errors: z.ZodError) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Convierte un ZodError en un mensaje legible por humanos (y por el agente IA),
 * p.ej. "page: Expected number, received string; identification: Required".
 * Sin esto el cliente solo ve "Input validation failed" y no puede corregir.
 */
function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.') || '(root)';
      return `${path}: ${e.message}`;
    })
    .join('; ');
}

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors }, 'Validation failed');
      throw new ValidationError(
        `Input validation failed - ${formatZodError(error)}`,
        error
      );
    }
    throw error;
  }
}

export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
