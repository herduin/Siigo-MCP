import { describe, it, expect } from 'vitest';
import { unwrapToolArgs } from '../../src/server/mcpServer';

/**
 * El AI Agent de n8n envía los argumentos envueltos en { tool, id, params }.
 * unwrapToolArgs debe extraer los params reales sin afectar las llamadas planas.
 */
describe('unwrapToolArgs', () => {
  it('desenvuelve el envelope { tool, id, params } de n8n', () => {
    const enveloped = {
      tool: 'siigo_profit_and_loss',
      id: '9f0f0514e',
      params: { year: 2026, month_start: 4, month_end: 4 },
    };
    expect(unwrapToolArgs(enveloped)).toEqual({
      year: 2026,
      month_start: 4,
      month_end: 4,
    });
  });

  it('deja intactos los argumentos planos (sin clave tool)', () => {
    const flat = { year: 2026, month_end: 4 };
    expect(unwrapToolArgs(flat)).toEqual(flat);
  });

  it('no desenvuelve siigo_raw_request legítimo (params sin clave tool)', () => {
    // raw_request tiene un campo `params` propio; sin `tool` no debe tocarse
    const rawArgs = {
      method: 'GET',
      endpoint: '/v1/invoices',
      params: { page: 1 },
    };
    expect(unwrapToolArgs(rawArgs)).toEqual(rawArgs);
  });

  it('desenvuelve raw_request cuando viene envuelto', () => {
    const enveloped = {
      tool: 'siigo_raw_request',
      id: 'abc',
      params: { method: 'GET', endpoint: '/v1/invoices', params: { page: 1 } },
    };
    expect(unwrapToolArgs(enveloped)).toEqual({
      method: 'GET',
      endpoint: '/v1/invoices',
      params: { page: 1 },
    });
  });

  it('devuelve {} para entradas no-objeto', () => {
    expect(unwrapToolArgs(undefined)).toEqual({});
    expect(unwrapToolArgs(null)).toEqual({});
    expect(unwrapToolArgs('foo')).toEqual({});
    expect(unwrapToolArgs([1, 2])).toEqual({});
  });

  it('no desenvuelve si params no es objeto plano', () => {
    const weird = { tool: 'x', params: 'string-no-objeto' };
    expect(unwrapToolArgs(weird)).toEqual(weird);
  });
});
