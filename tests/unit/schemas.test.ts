import { describe, it, expect } from 'vitest';
import {
  listCustomersSchema,
  listInvoicesSchema,
  listProductsSchema,
  listDocumentTypesSchema,
  listPaymentTypesSchema,
  searchCustomersSchema,
} from '../../src/schemas/siigo.schemas';
import { validateInput, ValidationError } from '../../src/utils/validation';

describe('Siigo input schemas — nombres de parámetros reales', () => {
  it('paginación usa page y page_size (snake_case) con defaults', () => {
    const result = validateInput(listCustomersSchema, {});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(25);
    // No debe existir el viejo pageSize
    expect((result as Record<string, unknown>).pageSize).toBeUndefined();
  });

  it('list_customers acepta identification y branch_office, no campos inventados', () => {
    const result = validateInput(listCustomersSchema, {
      identification: '900123456',
      branch_office: 0,
      created_start: '2024-01-01',
    });
    expect(result.identification).toBe('900123456');
    expect(result.created_start).toBe('2024-01-01');
    // Claves desconocidas (active, type, search) se descartan por Zod
    const stripped = validateInput(listCustomersSchema, { active: true, type: 'Customer' } as never);
    expect((stripped as Record<string, unknown>).active).toBeUndefined();
  });

  it('list_invoices usa created_start/end, date_start/end y customer_identification', () => {
    const result = validateInput(listInvoicesSchema, {
      created_start: '2024-01-01',
      date_end: '2024-12-31',
      customer_identification: '13832081',
    });
    expect(result.created_start).toBe('2024-01-01');
    expect(result.date_end).toBe('2024-12-31');
    expect(result.customer_identification).toBe('13832081');
  });

  it('list_products acepta code y rangos de fecha', () => {
    const result = validateInput(listProductsSchema, { code: 'Item-1' });
    expect(result.code).toBe('Item-1');
  });

  it('rechaza fechas con formato inválido', () => {
    expect(() => validateInput(listInvoicesSchema, { created_start: '01-01-2024' })).toThrow(ValidationError);
  });

  it('document_types exige type válido del enum', () => {
    expect(validateInput(listDocumentTypesSchema, { type: 'FV' }).type).toBe('FV');
    expect(() => validateInput(listDocumentTypesSchema, {})).toThrow(ValidationError);
    expect(() => validateInput(listDocumentTypesSchema, { type: 'ZZ' })).toThrow(ValidationError);
  });

  it('payment_types exige document_type', () => {
    expect(validateInput(listPaymentTypesSchema, { document_type: 'FV' }).document_type).toBe('FV');
    expect(() => validateInput(listPaymentTypesSchema, {})).toThrow(ValidationError);
  });

  it('search_customers exige identification (no búsqueda full-text)', () => {
    expect(validateInput(searchCustomersSchema, { identification: '900123' }).identification).toBe('900123');
    expect(() => validateInput(searchCustomersSchema, {})).toThrow(ValidationError);
  });
});
