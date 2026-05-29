# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server that exposes the Siigo Colombia accounting/invoicing API to AI agents and n8n. Transport is **HTTP + JSON-RPC 2.0** (not stdio). TypeScript ESM, Node 20+.

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

### Transport gotcha — two MCP server paths, only one runs

`src/server/mcpServer.ts` constructs the official `@modelcontextprotocol/sdk` `Server` with `CallToolRequestSchema`/`ListToolsRequestSchema` handlers and a `runStdio()` method. **None of this executes at runtime.** `index.ts` never calls `runStdio()`. Instead `HttpServer` (`src/server/httpServer.ts`) re-implements the JSON-RPC protocol by hand — it reads `mcpServer.getTools()` directly and dispatches `initialize` / `tools/list` / `tools/call` itself. So:

- The SDK `Server` instance is effectively dead code; the live behavior is in `httpServer.ts`.
- `MCPServer` is used at runtime only as a **tool container** (`getTools()`, `getServer`, and `options.siigoClient` accessed via bracket notation in `/ready`).
- When changing how tools are listed or invoked, edit `httpServer.ts`. The handlers in `mcpServer.ts` won't affect the running server.

### Tool registration pattern

Every tool category lives in `src/tools/*.tools.ts` and exports a `registerXxxTools(tools: Map, client: SiigoClient, ...)` function called from `MCPServer.registerAllTools()`. A tool is a plain object set on the map:

```ts
tools.set('siigo_xxx', {
  name: 'siigo_xxx',
  description: '...',           // AI-facing, verbose on purpose
  inputSchema: { type: 'object', properties: {...}, required: [...] },  // raw JSON Schema for MCP
  handler: async (args) => {
    const params = validateInput(zodSchema, args);   // Zod validation at the boundary
    const result = await client.get(SIIGO_ENDPOINTS.X, { params });
    return { success: true, data: result };           // { success, data } envelope
  },
});
```

Note `inputSchema` (JSON Schema, advertised to clients) and the Zod schema in `src/schemas/siigo.schemas.ts` (runtime validation) are **two separate definitions** — keep them in sync when editing a tool's params. To add a tool category, create `src/tools/<x>.tools.ts` with a `register…` export and wire it in `mcpServer.ts:registerAllTools()`.

### Write-tools flag is plumbed but not enforced

`ENABLE_WRITE_TOOLS` → `enableWriteTools` is threaded down to `registerCustomerTools`/`registerInvoiceTools` as `_enableWrite`, but every tool currently ignores it (parameter is prefixed `_` and eslint-disabled). All registered tools are **read-only GETs today.** If you implement write operations, gate them on this flag rather than registering unconditionally.

### Siigo client & auth

`src/siigo/siigoClient.ts` wraps axios with two interceptors:
- **request**: injects `Authorization` from `SiigoAuth.getToken()`.
- **response**: on `401`, refreshes the token once (`_authRetry` guard) and replays the request.

`SiigoAuth` (`siigoAuth.ts`) caches the token in memory and treats it as expired at **90% of `expires_in`** to refresh early. Every request also goes through `withRetry` (`src/utils/retries.ts`) using `maxRetries` from config. Errors are normalized in `enhanceError` into friendly `Error` messages by status code. Endpoint URLs are centralized in `src/siigo/endpoints.ts` — use `SIIGO_ENDPOINTS`, don't hardcode paths.

### HTTP endpoints

`GET /health` (liveness), `GET /ready` (calls `siigoClient.healthCheck()`), `GET /version`, `POST {MCP_PATH}` (default `/mcp`, JSON-RPC, behind optional Bearer auth). Auth is enforced by `createAuthMiddleware` only when `MCP_AUTH_TOKEN` is set; otherwise it's a passthrough.

## Conventions

- ESM throughout: relative imports **must** use the `.js` extension (e.g. `from './siigoClient.js'`) even though sources are `.ts`.
- Logging is `pino` via `src/utils/logger.ts` with secret redaction — never `console.log`; credentials are masked in logs.
- Validate all tool input with `validateInput(schema, args)` (throws `ValidationError`) before calling the client.
- Tests are vitest, currently unit-only under `tests/unit/` (utils). No integration/E2E harness exists yet.

## Deploy

Dockerfile + docker-compose.yml present; CI in `.github/` builds and publishes `ghcr.io/herduin/siigo-mcp-server` on push to `main` and on version tags. Default container port `3230`.
