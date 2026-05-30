/**
 * Helpers compartidos para definir tools de forma consistente:
 * annotations (lectura/escritura/destructiva), props de JSON Schema reusables
 * y wrappers de handler con el envelope { success, data }.
 */
import { validateInput } from '../utils/validation.js';
import logger from '../utils/logger.js';
import type { z } from 'zod';

// MCP tool annotations (hints para el agente)
export const RO = { readOnlyHint: true, destructiveHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;

// Props JSON Schema reusables
export const pageProps = {
  page: { type: 'number', description: 'Número de página (default: 1).' },
  page_size: { type: 'number', description: 'Tamaño de página (default: 25, máx: 100).' },
};

export const createdRangeProps = {
  created_start: { type: 'string', description: 'Fecha de creación >= (YYYY-MM-DD).' },
  created_end: { type: 'string', description: 'Fecha de creación <= (YYYY-MM-DD).' },
  updated_start: { type: 'string', description: 'Fecha de última modificación >= (YYYY-MM-DD).' },
  updated_end: { type: 'string', description: 'Fecha de última modificación <= (YYYY-MM-DD).' },
};

/**
 * Ejecuta un handler validando con Zod y envolviendo en { success, data }.
 * Centraliza el patrón repetido en todas las tools.
 */
export function run<T>(
  schema: z.ZodSchema<T>,
  args: unknown,
  label: string,
  fn: (_params: T) => Promise<unknown>
) {
  return (async () => {
    const params = validateInput(schema, args);
    logger.info({ params }, label);
    const data = await fn(params);
    return { success: true, data };
  })();
}
