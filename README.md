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
| `SIIGO_PARTNER_ID` | No | - | Siigo partner ID (if applicable) |
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
   - Add "MCP Client" node to your workflow
   - Configure connection:
     - **URL**: `http://your-server:3230/mcp`
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

### Authentication & Diagnostics
- `siigo_health_check` - Check API connectivity
- `siigo_get_token_status` - Get auth token status
- `siigo_raw_request` - Make raw API requests

### Customer Management
- `siigo_list_customers` - List customers (paginated)
- `siigo_get_customer` - Get customer by ID
- `siigo_search_customers` - Search customers

### Invoicing
- `siigo_list_invoices` - List invoices with filters
- `siigo_get_invoice` - Get invoice details
- `siigo_search_invoices` - Search invoices
- `siigo_get_invoice_pdf` - Get invoice PDF URL
- `siigo_get_invoice_xml` - Get electronic stamp XML

### Products & Inventory
- `siigo_list_products` - List products
- `siigo_get_product` - Get product details
- `siigo_search_products` - Search products
- `siigo_get_product_stock` - Get stock levels

### Taxes & Catalogs
- `siigo_list_taxes` - List tax types
- `siigo_list_document_types` - List document types
- `siigo_list_payment_methods` - List payment methods
- `siigo_list_cost_centers` - List cost centers
- `siigo_list_sellers` - List sellers

### Users
- `siigo_list_users` - List system users

### Payments & Receivables
- `siigo_list_payments` - List payments
- `siigo_get_payment` - Get payment details
- `siigo_list_receivables` - List outstanding invoices
- `siigo_list_accounts_receivable_by_customer` - Get customer AR

### Credit Notes
- `siigo_list_credit_notes` - List credit notes
- `siigo_get_credit_note` - Get credit note details

### Accounting
- `siigo_list_journal_entries` - List journal entries
- `siigo_get_journal_entry` - Get journal entry details

### AI-Optimized Reports
- `siigo_financial_summary` - Financial metrics summary
- `siigo_sales_summary` - Sales trends by period
- `siigo_customer_statement` - Customer account statement
- `siigo_monthly_revenue_report` - Monthly revenue trends
- `siigo_tax_summary` - Tax collection summary
- `siigo_accounts_receivable_aging` - AR aging analysis

## 📡 HTTP Endpoints

- `GET /health` - Health check (returns 200 OK)
- `GET /ready` - Readiness check (tests Siigo connectivity)
- `GET /version` - Server version and info
- `POST /mcp` - MCP endpoint (JSON-RPC 2.0)

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
   - Pull: `ghcr.io/herduin/siigo-mcp-server:latest`

2. **Create Container:**
   - Name: `siigo-mcp-server`
   - Image: `ghcr.io/herduin/siigo-mcp-server:latest`
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
docker pull ghcr.io/herduin/siigo-mcp-server:latest
```

### Manual Publishing

```bash
# Build image
docker build -t ghcr.io/herduin/siigo-mcp-server:latest .

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push image
docker push ghcr.io/herduin/siigo-mcp-server:latest
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

### MCP Integration Issues

1. **Test JSON-RPC initialize:**
   ```bash
   curl -X POST http://localhost:3230/mcp \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
   ```

2. **List available tools:**
   ```bash
   curl -X POST http://localhost:3230/mcp \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
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