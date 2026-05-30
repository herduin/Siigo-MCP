# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server that exposes the Siigo Colombia accounting/invoicing API to AI agents and n8n. Transport is **HTTP** using the official MCP SDK transports — **Streamable HTTP** (`/mcp`) and **SSE legacy** (`/sse` + `/messages`). TypeScript ESM, Node 20+.

## Commands

```bash
npm run dev            # Run with tsx (no build), loads .env
npm run build          # tsc → dist/
npm start              # node dist/index.js (requires build first)
npm run lint           # eslint src --ext .ts
npm run lint:fix       # eslint --fix
npm run typecheck      # tsc --noEmit
npm test               # vitest run (one-shot)
npm run test:watch     # vitest watch
npm run test:coverage  # vitest run --coverage

# Single test file / single test
npx vitest run tests/unit/retries.test.ts
npx vitest run -t "name of the test"
```

Required env to start: `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY` (process exits if missing). See `.env.example` and the env table in `README.md` for the rest.

## Architecture

Layered, with three concerns kept separate: HTTP/transport → MCP tool registry → Siigo API client.

**Boot flow** (`src/index.ts`): builds config from env → `SiigoClient` (fails fast on a `healthCheck` that just fetches an auth token) → `MCPServer` (registers tools) → `HttpServer` (Express) → `start()`.

### Transport wiring

`src/server/mcpServer.ts` is a **tool container + Server factory**. `registerAllTools()` fills a `Map` of tools once; `createServer()` returns a fresh `@modelcontextprotocol/sdk` `Server` wired with `ListToolsRequestSchema`/`CallToolRequestSchema` handlers that read that map. `getTools()` feeds `/ready` and `/version`; `getSiigoClient()` feeds `/ready`.

`src/server/httpServer.ts` mounts the SDK transports on Express and calls `mcpServer.createServer()` **once per session** (one `Server` per transport, to avoid cross-session state):

- **Streamable HTTP** on `MCP_PATH` (default `/mcp`): `POST` bootstraps a session on `initialize` (creates a `StreamableHTTPServerTransport` with a UUID `sessionIdGenerator`, tracked in `streamableTransports` by `Mcp-Session-Id`), `GET` opens the server→client SSE stream, `DELETE` closes it.
- **SSE legacy**: `GET /sse` opens a stream (`SSEServerTransport`, tracked in `sseTransports` by `sessionId`), `POST /messages?sessionId=...` delivers client messages.

Both transport groups sit behind the same `createAuthMiddleware`. DNS-rebinding protection is left off (SDK default), so the Cloudflare tunnel's rewritten `Host` is accepted. To change tool listing/calling behavior, edit the handlers in `createServer()`; transport/session plumbing lives in `httpServer.ts`.

### Tool registration pattern

Every tool category lives in `src/tools/*.tools.ts` and exports a `registerXxxTools(tools: Map, client: SiigoClient, ...)` function called from `MCPServer.registerAllTools()`. A tool is a plain object set on the map:

```ts
tools.set('siigo_xxx', {
  name: 'siigo_xxx',
  description: '...',           // AI-facing, en español, DEBE describir la salida
  inputSchema: { type: 'object', properties: {...}, required: [...] },  // JSON Schema (entradas)
  outputSchema: paginated(invoiceSchema),  // JSON Schema (salidas) desde output.schemas.ts
  handler: async (args) => {
    const params = validateInput(zodSchema, args);   // Zod validation at the boundary
    const result = await client.get(SIIGO_ENDPOINTS.X, { params });
    return { success: true, data: result };           // { success, data } envelope
  },
});
```

Three schemas per tool, keep them aligned:
- `inputSchema` (JSON Schema, advertised to clients) and the Zod schema in `src/schemas/siigo.schemas.ts` (runtime validation) — **two separate definitions**, same fields/required.
- `outputSchema` (JSON Schema) built from helpers in `src/schemas/output.schemas.ts` — `paginated(x)`, `single(x)`, `arrayOf(x)`, `envelope(x)` plus entity schemas (`customerSchema`, `invoiceSchema`, …) derived from the `*Out` objects in `siigoapi.apib`. `mcpServer.ts:createServer()` propagates `outputSchema` into `tools/list`.

**Query param names must match Siigo exactly** (snake_case): `page`/`page_size`, `created_start`/`created_end`, `updated_start`/`updated_end`, `date_start`/`date_end` (invoices), `identification`/`branch_office` (customers), `customer_identification`/`customer_branch_office`/`name`/`document_id` (invoices), `code` (products). The Zod schema both validates and **whitelists** params (unknown keys are stripped), so the validated object is passed straight as `params`. Don't reintroduce camelCase (`pageSize`, `startDate`, `customerId`) — Siigo silently ignores them. The reference is the API Blueprint `siigoapi.apib` (query tables ~2357/2710/3623; `*Out` objects 514-2188).

`siigo_list_tools` (`src/tools/meta.tools.ts`) is an agentic catalog tool; the SDK `instructions` (in `createServer()`) tell clients to call it first. To add a tool category, create `src/tools/<x>.tools.ts` with a `register…` export and wire it in `mcpServer.ts:registerAllTools()`.

### Shared helpers & write-tool gating

`src/tools/_helpers.ts` provides `run(zodSchema, args, logMsg, fn)` (validate → call → `{ success, data }`), the JSON-Schema prop fragments `pageProps`/`createdRangeProps`, and the `annotations` constants `RO` / `WRITE` / `DESTRUCTIVE`. New tools follow `src/tools/purchases.tools.ts` (the canonical example): read tools first, then `if (!enableWrite) return;`, then create/update/delete. `mcpServer.ts:registerAllTools()` passes `enableWriteTools` to every `registerXxxTools(tools, client, enableWrite)`; with it `false` (default) write tools are simply never registered, so they don't appear in `tools/list`. Every tool sets `annotations` (propagated to `tools/list`); deletes/annul use `DESTRUCTIVE` (`destructiveHint:true`). Write bodies use a lax `z.record` schema (e.g. `createInvoiceSchema`) since the full document shape lives in `siigoapi.apib`.

### Reports & P&L

`reports.tools.ts` has the accounting reports (`siigo_get_trial_balance`/`_by_third` via `POST /v1/test-balance-report*`, `siigo_get_accounts_payable`) plus value-added tools: `siigo_profit_and_loss`, `siigo_expenses_by_period`, `siigo_top_products`. The trial balance returns an Excel URL; `siigo_profit_and_loss` downloads it (axios) and parses it via `src/utils/xlsx.ts` (`parseXlsxRows` + `buildProfitAndLoss`, using **fflate** to unzip). Key xlsx gotchas captured there: cells have no `r` ref (map by sequential position) and class-4 income comes as a negative credit (sign is inverted). `fetchAllPages()` in `reports.tools.ts` paginates listings (cap 50 pages).

### Tool count

~51 read tools by default; ~81 with `ENABLE_WRITE_TOOLS=true`. The integration/gating tests assert both states (`tests/unit/gating.test.ts`).

### Write-tools flag (enforced)

`ENABLE_WRITE_TOOLS` → `enableWriteTools` is passed to every `registerXxxTools` and **gates registration** of create/update/delete/annul/email tools (see "Shared helpers & write-tool gating" below). Default is `false` → read-only. Catalog/report tools are always read-only and don't take the flag.

### Siigo client & auth

`src/siigo/siigoClient.ts` wraps axios with two interceptors:
- **request**: injects `Authorization` from `SiigoAuth.getToken()`.
- **response**: on `401`, refreshes the token once (`_authRetry` guard) and replays the request.

`SiigoAuth` (`siigoAuth.ts`) caches the token in memory and treats it as expired at **90% of `expires_in`** to refresh early. Every request also goes through `withRetry` (`src/utils/retries.ts`) using `maxRetries` from config. Errors are normalized in `enhanceError` into friendly `Error` messages by status code. Endpoint URLs are centralized in `src/siigo/endpoints.ts` — use `SIIGO_ENDPOINTS`, don't hardcode paths.

**Partner-Id is mandatory for data endpoints.** Siigo rejects `/v1/customers`, `/v1/invoices`, etc. with `400 invalid_partner_id` unless the `Partner-Id` header carries a value Siigo assigned to the integration. The client only sends it when `SIIGO_PARTNER_ID` is set (`siigoClient.ts` constructor). `/auth` and `/health` work without it, so `siigo_health_check` can pass while data tools 400 — set `SIIGO_PARTNER_ID` to fix.

**No `/v1/payments` endpoint exists in Siigo.** "Pagos recibidos" = Recibos de caja (`/v1/vouchers`); "pagos/egresos" = `/v1/payment-receipts`. Don't reintroduce a `/v1/payments` endpoint.

### HTTP endpoints

`GET /health` (liveness), `GET /ready` (calls `siigoClient.healthCheck()`), `GET /version`, `POST|GET|DELETE {MCP_PATH}` (default `/mcp`, Streamable HTTP), `GET /sse` + `POST /messages` (SSE legacy). The MCP routes sit behind optional Bearer auth — `createAuthMiddleware` enforces it only when `MCP_AUTH_TOKEN` is set; otherwise it's a passthrough.

## Conventions

- ESM throughout: relative imports **must** use the `.js` extension (e.g. `from './siigoClient.js'`) even though sources are `.ts`.
- Logging is `pino` via `src/utils/logger.ts` with secret redaction — never `console.log`; credentials are masked in logs.
- Validate all tool input with `validateInput(schema, args)` (throws `ValidationError`) before calling the client.
- Tests are vitest, currently unit-only under `tests/unit/` (utils). No integration/E2E harness exists yet.

## Deploy

Dockerfile + docker-compose.yml present; CI in `.github/` builds and publishes `ghcr.io/herduin/siigo-mcp-server` on push to `main` and on version tags. Default container port `3230`.
