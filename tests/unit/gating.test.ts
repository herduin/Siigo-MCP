import { describe, it, expect } from 'vitest';
import { MCPServer } from '../../src/server/mcpServer';
import { SiigoClient } from '../../src/siigo/siigoClient';

function makeServer(enableWriteTools: boolean) {
  const client = new SiigoClient({
    baseUrl: 'https://api.siigo.com',
    username: 'test',
    accessKey: 'test',
    timeoutMs: 1000,
    maxRetries: 0,
  });
  return new MCPServer({ siigoClient: client, enableWriteTools });
}

const writeNames = (names: string[]) =>
  names.filter((n) => /^siigo_(create|update|delete|annul|send)/.test(n));

describe('ENABLE_WRITE_TOOLS gating', () => {
  it('write OFF: no expone tools de escritura', () => {
    const names = makeServer(false).getTools().map((t) => t.name);
    expect(writeNames(names).length).toBe(0);
    // pero sí hay lectura nueva
    expect(names).toContain('siigo_list_purchases');
    expect(names).toContain('siigo_profit_and_loss');
    expect(names).toContain('siigo_get_accounts_payable');
  });

  it('write ON: expone create/update/delete', () => {
    const names = makeServer(true).getTools().map((t) => t.name);
    expect(writeNames(names).length).toBeGreaterThan(20);
    expect(names).toContain('siigo_create_invoice');
    expect(names).toContain('siigo_annul_invoice');
    expect(names).toContain('siigo_create_purchase');
    expect(names).toContain('siigo_create_webhook');
  });

  it('toda tool de escritura declara annotations no-readOnly', () => {
    const tools = makeServer(true).getTools().filter((t) => /^siigo_(create|update|delete|annul|send)/.test(t.name));
    for (const t of tools) {
      expect(t.annotations, `${t.name} sin annotations`).toBeTruthy();
      expect(t.annotations.readOnlyHint).toBe(false);
    }
  });
});
