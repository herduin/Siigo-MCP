# Siigo MCP Server

A complete Model Context Protocol (MCP) server for integrating Siigo Colombia API with n8n and AI agents. This server exposes Siigo's accounting and invoicing capabilities through a standardized MCP interface over HTTP.

## 🚀 Features

- **MCP Compatible**: Fully compliant with MCP specification for seamless AI agent integration
- **n8n Ready**: Works out-of-the-box with n8n MCP Client Tool
- **Comprehensive Tools**: 30+ tools covering customers, invoices, products, payments, and more
- **AI-Optimized Reports**: Pre-built financial reports designed for AI agent consumption
- **Security First**: Optional Bearer token authentication, no hardcoded secrets
- **Production Ready**: Docker support, health checks, retry logic, rate limiting
- **Type Safe**: Built with TypeScript for reliability and maintainability

## 📋 Requirements

- Node.js 20+
- Docker (optional, for containerized deployment)
- Siigo API credentials (username, access key)

## 🏗️ Architecture

```
src/
├── index.ts                 # Application entry point
├── server/
│   ├── httpServer.ts        # Express HTTP server with MCP endpoint
│   ├── mcpServer.ts         # MCP protocol implementation
│   ├── authMiddleware.ts    # Bearer token authentication
│   └── errorHandler.ts      # Centralized error handling
├── siigo/
│   ├── siigoClient.ts       # Siigo API client with retry logic
│   ├── siigoAuth.ts         # Authentication token management
│   ├── siigoTypes.ts        # TypeScript type definitions
│   └── endpoints.ts         # API endpoint constants
├── tools/
│   ├── customers.tools.ts   # Customer management tools
│   ├── invoices.tools.ts    # Invoice and billing tools
│   ├── products.tools.ts    # Product/inventory tools
│   ├── taxes.tools.ts       # Tax and catalog tools
│   ├── users.tools.ts       # User management tools
│   ├── payments.tools.ts    # Payment and receivables tools
│   ├── creditNotes.tools.ts # Credit note tools
│   ├── journals.tools.ts    # Journal entry tools
│   ├── reports.tools.ts     # AI-optimized report tools
│   └── raw.tools.ts         # Health check and raw request tools
├── schemas/
│   ├── common.schemas.ts    # Common Zod schemas
│   └── siigo.schemas.ts     # Siigo-specific schemas
└── utils/
    ├── logger.ts            # Pino logger with redaction
    ├── validation.ts        # Zod validation helpers
    ├── retries.ts           # Retry logic with backoff
    └── pagination.ts        # Pagination utilities
```

## 🔧 Installation

### Local Development

```bash
# Clone repository
git clone https://github.com/herduin/Siigo-MCP.git
cd Siigo-MCP

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your Siigo credentials
nano .env

# Run in development mode
npm run dev

# Or build and run in production mode
npm run build
npm start
```

### Docker

```bash
# Build image
docker build -t siigo-mcp-server .

# Run container
docker run -p 3230:3230 \
  -e SIIGO_USERNAME=your_username \
  -e SIIGO_ACCESS_KEY=your_access_key \
  siigo-mcp-server
```

### Docker Compose

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env

# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3230` | HTTP server port |
| `MCP_PATH` | No | `/mcp` | MCP endpoint path |
| `MCP_AUTH_TOKEN` | No | - | Bearer token for MCP auth (optional) |
| `SIIGO_BASE_URL` | No | `https://api.siigo.com` | Siigo API base URL |
| `SIIGO_USERNAME` | **Yes** | - | Siigo API username |
| `SIIGO_ACCESS_KEY` | **Yes** | - | Siigo API access key |
| `SIIGO_PARTNER_ID` | **Recomendado** | - | Partner-Id asignado por Siigo. La API lo **exige** en los endpoints de datos (clientes, facturas, etc.); sin un valor válido devuelven `400 invalid_partner_id`. Solo `/auth` y `/health` funcionan sin él. |
| `SIIGO_TIMEOUT_MS` | No | `30000` | API request timeout (ms) |
| `SIIGO_MAX_RETRIES` | No | `3` | Max retry attempts |
| `ENABLE_WRITE_TOOLS` | No | `false` | Enable write operations |
| `LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |
| `NODE_ENV` | No | `production` | Node environment |

### Security Considerations

⚠️ **Write operations are disabled by default.** Set `ENABLE_WRITE_TOOLS=true` only in controlled environments.

- Use `MCP_AUTH_TOKEN` to protect the MCP endpoint in production
- Never commit `.env` files or hardcode credentials
- Siigo credentials are redacted from logs automatically
- Consider using Docker secrets or environment injection for credentials

## 🔌 n8n Integration

### Setup Steps

1. **Install n8n MCP Client Tool** (if not already installed)

2. **Add MCP Server in n8n workflow:**
   - Add "MCP Client Tool" node to your workflow
   - Configure connection:
     - **Server Transport**: `HTTP Streamable` (recommended) — or `Server Sent Events (SSE)` for older clients
     - **URL**: `http://your-server:3230/mcp` (Streamable HTTP) — or `http://your-server:3230/sse` (SSE)
     - **Authentication**: Bearer Token (if `MCP_AUTH_TOKEN` is set)
     - **Token**: Your configured `MCP_AUTH_TOKEN`

3. **Select Tools:**
   - Choose "All Tools" or select specific tools
   - Available tools will appear in the node

4. **Use in AI Agent:**
   - Connect MCP Client to AI Agent node
   - Agent can now use Siigo tools automatically

### Example n8n Workflow

```
Webhook → AI Agent → MCP Client (Siigo) → Response
```

The AI agent can now:
- "Get customer information for ID 12345"
- "List all invoices from last month"
- "Generate financial summary for Q1 2024"
- "Show accounts receivable aging report"

## 🛠️ Available MCP Tools

> **Descúbrelas en runtime:** llama a `siigo_list_tools` para obtener el catálogo
> completo agrupado por dominio. Cada tool publica su contrato exacto en
> `inputSchema` (entradas) y `outputSchema` (salidas) vía `tools/list`.
> Convenciones: fechas `YYYY-MM-DD`; paginación `page` / `page_size`; los listados
> devuelven `{ pagination, results, _links }` envuelto en `{ success, data }`.

### Meta / Diagnóstico
- `siigo_list_tools` - Catálogo agéntico de todas las herramientas (llamar primero)
- `siigo_health_check` - Verifica conectividad con la API
- `siigo_get_token_status` - Estado del token de autenticación
- `siigo_raw_request` - Petición cruda a cualquier endpoint

### Clientes
- `siigo_list_customers` - Lista clientes (filtros: identification, branch_office, created/updated)
- `siigo_get_customer` - Cliente por ID (GUID)
- `siigo_search_customers` - Busca clientes por identificación

### Facturas de venta
- `siigo_list_invoices` - Lista facturas (created/updated/date ranges, customer_identification, name, document_id)
- `siigo_get_invoice` - Factura por ID
- `siigo_search_invoices` - Busca por name / customer_identification / document_id
- `siigo_get_invoice_pdf` - PDF de la factura
- `siigo_get_invoice_xml` - XML de la factura electrónica (DIAN)

### Productos / Inventario
- `siigo_list_products` - Lista productos (filtros: code, created/updated)
- `siigo_get_product` - Producto por ID
- `siigo_search_products` - Busca productos por código
- `siigo_get_product_stock` - Stock/inventario derivado del producto

### Catálogos
- `siigo_list_taxes` - Tipos de impuesto
- `siigo_list_document_types` - Tipos de documento (**requiere** `type`: FV|NC|FC|DS|RC|RP|CC|C)
- `siigo_list_payment_methods` - Formas de pago (**requiere** `document_type`)
- `siigo_list_cost_centers` - Centros de costo
- `siigo_list_sellers` - Vendedores (usuarios)
- `siigo_list_users` - Usuarios del sistema

### Recibos de caja y pago
- `siigo_list_vouchers` - Lista recibos de caja (cobros recibidos)
- `siigo_get_voucher` - Recibo de caja por ID
- `siigo_list_payment_receipts` - Lista recibos de pago/egreso
- `siigo_get_payment_receipt` - Recibo de pago/egreso por ID

### Cartera (cuentas por cobrar)
- `siigo_list_receivables` - Facturas con saldo pendiente (balance > 0)
- `siigo_list_accounts_receivable_by_customer` - Cartera de un cliente (por customer_identification)

### Notas crédito
- `siigo_list_credit_notes` - Lista notas crédito
- `siigo_get_credit_note` - Nota crédito por ID
- `siigo_get_credit_note_pdf` - PDF de la nota crédito

### Compras / gastos
- `siigo_list_purchases` - Lista facturas de compra/gasto (filtros de fecha)
- `siigo_get_purchase` - Compra por ID

### Cotizaciones
- `siigo_list_quotations` - Lista cotizaciones
- `siigo_get_quotation` - Cotización por ID

### Documentos soporte
- `siigo_list_support_documents` - Lista documentos soporte
- `siigo_get_support_document` - Documento soporte por ID

### Inventario / catálogos adicionales
- `siigo_list_account_groups` - Categorías de inventario
- `siigo_list_warehouses` - Bodegas
- `siigo_list_price_lists` - Listas de precio
- `siigo_list_fixed_assets` - Activos fijos
- `siigo_list_cities`, `siigo_list_id_types`, `siigo_list_fiscal_responsibilities`

### Contabilidad
- `siigo_list_journal_entries` - Lista comprobantes contables
- `siigo_get_journal_entry` - Comprobante por ID

### Reportes contables (Siigo)
- `siigo_get_trial_balance` - Balance de prueba (Excel)
- `siigo_get_trial_balance_by_third` - Balance de prueba por tercero
- `siigo_get_accounts_payable` - Cuentas por pagar

### Reportes de valor agregado (MCP)
- `siigo_profit_and_loss` - **Estado de Resultados (P&L) ya estructurado** (descarga y procesa el balance de prueba)
- `siigo_expenses_by_period` - Gastos por proveedor y concepto
- `siigo_top_products` - Ranking de productos vendidos
- `siigo_financial_summary`, `siigo_sales_summary`, `siigo_customer_statement`, `siigo_monthly_revenue_report`, `siigo_tax_summary`, `siigo_accounts_receivable_aging`

### Escritura (CRUD) — requiere `ENABLE_WRITE_TOOLS=true`
Deshabilitadas por defecto. Cada una declara `annotations` (`readOnlyHint:false`; `destructiveHint:true` en delete/annul) para que el agente distinga operaciones peligrosas.
- Facturas: `siigo_create_invoice`, `siigo_update_invoice`, `siigo_delete_invoice`, `siigo_annul_invoice`, `siigo_send_invoice_email`, `siigo_create_invoice_batch`
- Clientes/Productos/Cotizaciones/Compras/Doc. soporte/Recibos pago: `create` / `update` / `delete`
- Notas crédito / Recibos de caja / Comprobantes: `create`
- Categorías inventario: `create` / `update`
- Webhooks: `siigo_list_webhooks`, `create` / `update` / `delete`

## 📡 HTTP Endpoints

- `GET /health` - Health check (returns 200 OK)
- `GET /ready` - Readiness check (tests Siigo connectivity)
- `GET /version` - Server version and info
- `POST|GET|DELETE /mcp` - MCP **Streamable HTTP** transport (session via `Mcp-Session-Id` header)
- `GET /sse` + `POST /messages?sessionId=...` - MCP **SSE** legacy transport

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Type check
npm run typecheck
```

## 🐳 Portainer Deployment

### Using Portainer Stacks

1. Log into Portainer
2. Navigate to **Stacks**
3. Click **Add Stack**
4. Name: `siigo-mcp`
5. Build method: **Repository**
   - Repository URL: `https://github.com/herduin/Siigo-MCP`
   - Repository reference: `main`
   - Compose path: `docker-compose.yml`
6. Add environment variables:
   ```
   SIIGO_USERNAME=your_username
   SIIGO_ACCESS_KEY=your_access_key
   MCP_AUTH_TOKEN=your_secure_token
   ```
7. Click **Deploy the stack**

### Manual Docker Deployment in Portainer

1. **Pull Image:**
   - Go to **Images**
   - Pull: `ghcr.io/herduin/siigo-mcp:latest`

2. **Create Container:**
   - Name: `siigo-mcp-server`
   - Image: `ghcr.io/herduin/siigo-mcp:latest`
   - Port mapping: `3230:3230`
   - Environment variables: (add from table above)
   - Restart policy: `unless-stopped`

## 📦 GitHub Container Registry

### Publishing Image

The GitHub Actions workflow automatically builds and publishes Docker images on:
- Push to `main` branch
- Creation of version tags (e.g., `v1.0.0`)

### Pulling Published Image

```bash
docker pull ghcr.io/herduin/siigo-mcp:latest
```

### Manual Publishing

```bash
# Build image
docker build -t ghcr.io/herduin/siigo-mcp:latest .

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push image
docker push ghcr.io/herduin/siigo-mcp:latest
```

## 🔍 Troubleshooting

### Connection Issues

1. **Check health endpoint:**
   ```bash
   curl http://localhost:3230/health
   ```

2. **Check Siigo connectivity:**
   ```bash
   curl http://localhost:3230/ready
   ```

3. **View logs:**
   ```bash
   # Docker
   docker logs siigo-mcp-server

   # Docker Compose
   docker-compose logs -f
   ```

### Authentication Errors

- Verify `SIIGO_USERNAME` and `SIIGO_ACCESS_KEY` are correct
- Check token status: Call `siigo_get_token_status` tool
- Ensure network connectivity to `api.siigo.com`

### `400 invalid_partner_id` en endpoints de datos

Siigo **exige** el header `Partner-Id` con un valor válido (el que Siigo asignó a tu
integración) en los endpoints de datos. Si `siigo_health_check` responde OK pero
`siigo_list_customers` / `siigo_list_invoices` devuelven `400 invalid_partner_id`,
configura `SIIGO_PARTNER_ID` con tu Partner-Id válido y reinicia el servicio.

### MCP Integration Issues

The MCP endpoint uses the Streamable HTTP transport, so requests must accept
both JSON and SSE (`Accept: application/json, text/event-stream`) and reuse the
`Mcp-Session-Id` returned by `initialize`.

1. **Initialize a session** (returns the `Mcp-Session-Id` response header):
   ```bash
   curl -i -X POST http://localhost:3230/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
   ```

2. **List available tools** (reuse the session id):
   ```bash
   curl -X POST http://localhost:3230/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Mcp-Session-Id: SESSION_ID_FROM_STEP_1" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
   ```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and lint
5. Submit a pull request

## 📄 License

MIT

## 🔗 References

- [Siigo API Documentation](https://siigoapi.docs.apiary.io/)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [n8n MCP Client Tool](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp/)

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review logs for error details

---

Built with ❤️ for AI agents and n8n automation