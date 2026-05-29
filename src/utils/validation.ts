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

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ errors: error.errors }, 'Validation failed');
      throw new ValidationError('Input validation failed', error);
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
