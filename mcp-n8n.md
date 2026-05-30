# Cómo construir un servidor MCP compatible con n8n

> Guía práctica destilada de la construcción del **Siigo-MCP**. Reúne las decisiones,
> los errores que cometimos y cómo se resolvieron, para que el siguiente servidor MCP
> funcione con el nodo **MCP Client Tool** de n8n a la primera.

---

## TL;DR — los 6 que sí o sí

1. **Usa el transporte oficial del SDK, no JSON-RPC a mano.** n8n habla **Streamable HTTP** (y SSE legacy). Un `POST /mcp` que responde JSON plano **no** sirve.
2. **Si una tool declara `outputSchema`, DEBE devolver `structuredContent`.** Si no, n8n rechaza con `-32600`. Este fue el bug más sutil.
3. **Maneja sesiones** (`Mcp-Session-Id`): `POST` inicializa, `GET` abre el stream, `DELETE` cierra.
4. **Deja la protección DNS-rebinding desactivada** (default del SDK) para que funcione detrás de proxy/túnel (Cloudflare) que reescribe el `Host`.
5. **Expón también SSE legacy** (`GET /sse` + `POST /messages`) para clientes antiguos.
6. **Respuestas vienen como SSE** (`event: message\ndata: {...}`). Acepta `application/json, text/event-stream`.

---

## 1. El error de fondo: transporte

n8n *MCP Client Tool* soporta dos transportes: **HTTP Streamable** (recomendado) y **SSE**.
Ambos son protocolos con estado (handshake + stream), no un simple request/response.

**Lo que NO funciona** (nuestro primer intento): implementar `POST /mcp` leyendo `req.body` y
respondiendo JSON-RPC manualmente. `curl` funciona, pero n8n abre un `GET` para el stream y al
recibir `404` (o no encontrar `Mcp-Session-Id`) falla silenciosamente.

**Lo que funciona**: montar los transportes del SDK `@modelcontextprotocol/sdk` sobre Express.

### Streamable HTTP (stateful)

```ts
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', auth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport!),
    });
    transport.onclose = () => { if (transport!.sessionId) transports.delete(transport!.sessionId); };
    await server.connect(transport);          // server = new Server(...) del SDK
  }
  if (!transport) {
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session' }, id: null });
    return;
  }
  await transport.handleRequest(req, res, req.body);  // body pre-parseado por express.json()
});

app.get('/mcp', auth, async (req, res) => {     // stream servidor→cliente
  const t = transports.get(req.headers['mcp-session-id'] as string);
  if (!t) return res.status(400).send('Invalid or missing session ID');
  await t.handleRequest(req, res);
});

app.delete('/mcp', auth, async (req, res) => {  // cierre de sesión
  const t = transports.get(req.headers['mcp-session-id'] as string);
  if (!t) return res.status(400).send('Invalid or missing session ID');
  await t.handleRequest(req, res);
});
```

### SSE legacy (compatibilidad)

```ts
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
const sse = new Map<string, SSEServerTransport>();

app.get('/sse', auth, async (_req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  sse.set(transport.sessionId, transport);
  res.on('close', () => sse.delete(transport.sessionId));
  await server.connect(transport);
});

app.post('/messages', auth, async (req, res) => {
  const t = sse.get(req.query.sessionId as string);
  if (!t) return res.status(400).send('No transport for sessionId');
  await t.handlePostMessage(req, res, req.body);
});
```

> **Una instancia de `Server` por sesión.** Crea el `Server` del SDK (con sus handlers) dentro
> de una *factory* y llama `server.connect(transport)` por cada transporte/sesión, para no
> compartir estado entre sesiones concurrentes.

---

## 2. El bug sutil: `outputSchema` ⟹ `structuredContent`

Si tus tools declaran `outputSchema` (muy recomendable para que el agente entienda la salida),
el handler **debe** devolver `structuredContent` además del `content` textual. Si solo devuelves
`content`, n8n falla con **`-32600` (Invalid Request)**.

```ts
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.get(request.params.name);
  const result = await tool.handler(request.params.arguments || {});
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    // CLAVE: obligatorio cuando la tool tiene outputSchema
    ...(tool.outputSchema ? { structuredContent: result } : {}),
  };
});
```

Y al listar, propaga `outputSchema` (y `annotations`):

```ts
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...tools.values()].map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
    ...(t.annotations ? { annotations: t.annotations } : {}),
  })),
}));
```

---

## 3. Detrás de un proxy / túnel (Cloudflare, Nginx)

El `StreamableHTTPServerTransport` trae protección **DNS-rebinding** que valida el header `Host`.
Detrás de un túnel Cloudflare el `Host` llega reescrito → si la activas, **bloquea** las
peticiones. En el SDK actual viene **desactivada por defecto** — déjala así, o si necesitas
activarla, configura `allowedHosts`/`allowedOrigins` con tu dominio público:

```ts
new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  // enableDnsRebindingProtection: true,           // solo si...
  // allowedHosts: ['tu-dominio.com', 'localhost:3230'],
});
```

Además, el proxy debe **no bufferizar** el SSE (para Nginx: `proxy_buffering off;`). Cloudflare
tunnel lo maneja bien sin configuración extra.

---

## 4. Autenticación

Middleware Bearer simple en las rutas MCP. Hazlo *passthrough* si no hay token configurado, y
responde en formato JSON-RPC al fallar (n8n espera el envelope):

```ts
function auth(req, res, next) {
  if (!TOKEN) return next();                        // sin token → abierto
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
  }
  next();
}
```

En n8n: *Authentication = Bearer*, y pega el token.

---

## 5. Diseño de tools para uso agéntico

Lecciones que mejoran mucho la experiencia del agente en n8n:

- **`inputSchema` Y `outputSchema`** en cada tool. El agente necesita ambos contratos.
- **Envelope consistente**: `{ success: boolean, data: <payload> }`. Predecible para el agente.
- **Listados paginados**: documenta `{ pagination, results, _links }` en el outputSchema.
- **`annotations`** por tool: `{ readOnlyHint, destructiveHint }`. n8n/el agente distinguen
  lecturas de operaciones peligrosas (delete/anular).
- **`instructions`** en el `Server` (se entregan en `initialize`): dile al agente qué hacer al
  conectarse. Ej.: "invoca primero `xxx_list_tools` para ver el catálogo".
- **Una tool catálogo** (`xxx_list_tools`) que devuelva el inventario agrupado con un resumen
  por herramienta — el agente la usa para orientarse.
- **Descripciones que incluyan la SALIDA**, no solo la entrada ("Devuelve … con campos …").
- **Validación en el borde** con Zod (o similar) antes de llamar la API upstream; que el Zod
  funcione también como *whitelist* (descarta claves desconocidas).

---

## 6. Endpoints HTTP de salud (para Docker/orquestador)

- `GET /health` → liveness (200 fijo, sin tocar upstream).
- `GET /ready` → readiness (verifica conexión al backend).
- `GET /version` → nombre, versión, transportes y nº de tools (útil para confirmar despliegues).
- `POST|GET|DELETE /mcp` y `GET /sse` + `POST /messages` → MCP.

`/version` es oro para verificar que un redeploy realmente tomó la imagen nueva.

---

## 7. Despliegue (Docker + Portainer)

- **Imagen multi-arch** (`linux/amd64,linux/arm64`) si corres en distintos hosts.
- **Healthcheck** en el contenedor apuntando a `/health`.
- **El webhook de stack de Portainer NO re-baja `:latest` por defecto.** Con tags mutables,
  el webhook recrea el contenedor con la imagen **cacheada**. Soluciones:
  - Activar **"Re-pull image"** en el stack (Automatic updates), o
  - Redesplegar vía **API de Portainer** con `pullImage: true`:
    ```bash
    curl -fsSL -X PUT -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
      --data '{"stackFileContent":"...","env":[...],"prune":false,"pullImage":true}' \
      "$PORTAINER_URL/api/stacks/$STACK_ID?endpointId=$ENDPOINT_ID"
    ```
- En CI: build → push → **espera unos segundos** a que el registro propague → dispara el redeploy.

---

## 8. Errores comunes y su causa

| Síntoma | Causa | Solución |
|---|---|---|
| n8n no conecta, `curl` sí | JSON-RPC a mano, sin transporte SSE/Streamable | Montar `StreamableHTTPServerTransport` del SDK |
| `-32600 Invalid Request` al llamar una tool | tool con `outputSchema` pero sin `structuredContent` | Devolver `structuredContent` en el handler |
| `GET /mcp` → 404 | Endpoint GET no implementado | Implementar `GET`/`DELETE /mcp` delegando a `handleRequest` |
| `400 No valid session` | Falta `Mcp-Session-Id` o sesión no inicializada | Cliente debe `initialize` primero y reusar el header |
| Conexión cae detrás del túnel | DNS-rebinding protection activa | Dejarla off o configurar `allowedHosts` |
| `401 Unauthorized` | Token mal/ausente | Bearer correcto en n8n |
| SSE se corta / no llega | Proxy bufferiza | `proxy_buffering off` (Nginx); Cloudflare ok |
| Redeploy no actualiza | Webhook sin re-pull de `:latest` | Re-pull image / API con `pullImage:true` |

---

## 9. Verificación end-to-end (sin n8n, con curl)

El handshake real (las respuestas llegan como SSE, por eso `Accept` incluye `text/event-stream`):

```bash
U=https://tu-servidor/mcp
H=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Authorization: Bearer TOKEN")

# 1) initialize → captura el header Mcp-Session-Id
SID=$(curl -s -D - -o /dev/null -X POST $U "${H[@]}" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}' | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

# 2) notificación obligatoria
curl -s -o /dev/null -X POST $U "${H[@]}" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3) listar tools (reusando la sesión)
curl -s -X POST $U "${H[@]}" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 4) llamar una tool
curl -s -X POST $U "${H[@]}" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"mi_tool","arguments":{}}}'
```

Si `initialize` devuelve `Mcp-Session-Id`, `tools/list` trae `outputSchema`, y `tools/call`
devuelve `structuredContent` → está listo para n8n.

---

## 10. Configuración del nodo en n8n

1. Nodo **MCP Client Tool**.
2. **Server Transport**: `HTTP Streamable` (o `Server Sent Events (SSE)` para clientes viejos).
3. **URL**: `https://tu-servidor/mcp` (Streamable) o `https://tu-servidor/sse` (SSE).
4. **Authentication**: `Bearer` + token (si el servidor lo exige).
5. **Tools**: "All" o selecciona. Conéctalo a un **AI Agent**.

---

## 11. Checklist de un MCP listo para n8n

- [ ] Transporte Streamable HTTP del SDK montado en `POST|GET|DELETE /mcp`.
- [ ] SSE legacy en `GET /sse` + `POST /messages`.
- [ ] Sesiones por `Mcp-Session-Id`; una instancia de `Server` por sesión.
- [ ] `structuredContent` devuelto siempre que la tool tenga `outputSchema`.
- [ ] `outputSchema` y `annotations` propagados en `tools/list`.
- [ ] DNS-rebinding off (o `allowedHosts` con el dominio público).
- [ ] Auth Bearer (passthrough si no hay token).
- [ ] `/health`, `/ready`, `/version`.
- [ ] `instructions` + tool catálogo (`*_list_tools`).
- [ ] Validación de input (Zod) como whitelist.
- [ ] Imagen multi-arch + healthcheck + redeploy con re-pull.
- [ ] Verificado por curl: initialize → session-id, tools/list con outputSchema, tools/call con structuredContent.

---

*Base: `@modelcontextprotocol/sdk` ^1.29, Express 4, Node 20+. Patrón implementado en
`src/server/httpServer.ts` y `src/server/mcpServer.ts` de este repositorio.*
