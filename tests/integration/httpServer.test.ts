import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { HttpServer } from '../../src/server/httpServer';
import { MCPServer } from '../../src/server/mcpServer';
import { SiigoClient } from '../../src/siigo/siigoClient';

/**
 * Integration test for the MCP Streamable HTTP transport.
 * Uses a real SiigoClient instance (no network is touched: tools/list and the
 * handshake never call the Siigo API) and the real SDK transport, so this
 * guards against regressions in the session handshake that n8n relies on.
 */
describe('HttpServer — MCP Streamable HTTP transport', () => {
  let httpServer: HttpServer;
  let listening: Server;
  let baseUrl: string;
  const TOKEN = 'test-token';

  const headers = (sessionId?: string) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${TOKEN}`,
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
  });

  // Streamable HTTP responses come back as SSE: `event: message\ndata: {json}`
  const parseSse = (text: string) => {
    const line = text.split('\n').find((l) => l.startsWith('data:'));
    return line ? JSON.parse(line.slice(5).trim()) : JSON.parse(text);
  };

  beforeAll(async () => {
    const siigoClient = new SiigoClient({
      baseUrl: 'https://api.siigo.com',
      username: 'test',
      accessKey: 'test',
      timeoutMs: 1000,
      maxRetries: 0,
    });
    const mcpServer = new MCPServer({ siigoClient, enableWriteTools: false });
    httpServer = new HttpServer(mcpServer, {
      port: 0,
      mcpPath: '/mcp',
      authToken: TOKEN,
      maxPayloadSize: '1mb',
    });

    listening = httpServer.getApp().listen(0);
    await new Promise<void>((resolve) => listening.once('listening', () => resolve()));
    const { port } = listening.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    listening?.close();
  });

  const initialize = async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1' },
        },
      }),
    });
    return res;
  };

  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('initialize returns an Mcp-Session-Id, serverInfo and instructions', async () => {
    const res = await initialize();
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-session-id')).toBeTruthy();
    const body = parseSse(await res.text());
    expect(body.result.serverInfo.name).toBe('siigo-mcp-server');
    // instructions debe indicar al agente que consulte siigo_list_tools al conectarse
    expect(body.result.instructions).toContain('siigo_list_tools');
  });

  it('lists all tools when reusing the session', async () => {
    const initRes = await initialize();
    const sessionId = initRes.headers.get('mcp-session-id')!;
    await initRes.text();

    // Required notification before normal operation
    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(sessionId),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(sessionId),
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    expect(res.status).toBe(200);
    const body = parseSse(await res.text());
    expect(Array.isArray(body.result.tools)).toBe(true);
    expect(body.result.tools.length).toBeGreaterThanOrEqual(30);
    expect(body.result.tools.some((t: { name: string }) => t.name === 'siigo_health_check')).toBe(true);
    // siigo_list_tools debe estar publicada
    expect(body.result.tools.some((t: { name: string }) => t.name === 'siigo_list_tools')).toBe(true);
    // Toda tool debe declarar inputSchema y outputSchema (contratos completos)
    for (const tool of body.result.tools) {
      expect(tool.inputSchema, `${tool.name} sin inputSchema`).toBeTruthy();
      expect(tool.outputSchema, `${tool.name} sin outputSchema`).toBeTruthy();
    }
  });

  it('siigo_list_tools returns a grouped agentic catalog', async () => {
    const initRes = await initialize();
    const sessionId = initRes.headers.get('mcp-session-id')!;
    await initRes.text();
    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(sessionId),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(sessionId),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'siigo_list_tools', arguments: {} },
      }),
    });
    expect(res.status).toBe(200);
    const body = parseSse(await res.text());
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.success).toBe(true);
    // Tools con outputSchema DEBEN devolver structuredContent o el MCP Client (n8n) falla con -32600
    expect(body.result.structuredContent, 'falta structuredContent').toEqual(payload);
    expect(payload.data.total).toBeGreaterThanOrEqual(30);
    expect(payload.data.groups.Clientes).toBeTruthy();
    expect(payload.data.groups['Facturas de venta']).toBeTruthy();
    // customer_statement debe quedar en Reportes, no en Clientes
    expect(payload.data.groups.Reportes.some((t: { name: string }) => t.name === 'siigo_customer_statement')).toBe(true);
  });

  it('rejects a non-initialize POST without a session', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
    });
    expect(res.status).toBe(400);
  });
});
