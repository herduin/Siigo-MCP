import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SiigoClient } from '../siigo/siigoClient.js';
import logger from '../utils/logger.js';

// Import all tools
import { registerCustomerTools } from '../tools/customers.tools.js';
import { registerInvoiceTools } from '../tools/invoices.tools.js';
import { registerProductTools } from '../tools/products.tools.js';
import { registerTaxTools } from '../tools/taxes.tools.js';
import { registerUserTools } from '../tools/users.tools.js';
import { registerPaymentTools } from '../tools/payments.tools.js';
import { registerCreditNoteTools } from '../tools/creditNotes.tools.js';
import { registerJournalTools } from '../tools/journals.tools.js';
import { registerReportTools } from '../tools/reports.tools.js';
import { registerRawTools } from '../tools/raw.tools.js';
import { registerMetaTools } from '../tools/meta.tools.js';
import { registerPurchaseTools } from '../tools/purchases.tools.js';
import { registerQuotationTools } from '../tools/quotations.tools.js';
import { registerSupportDocumentTools } from '../tools/supportDocuments.tools.js';
import { registerAccountGroupTools } from '../tools/accountGroups.tools.js';
import { registerWebhookTools } from '../tools/webhooks.tools.js';

const SERVER_INFO = {
  name: 'siigo-mcp-server',
  version: '1.0.0',
};

const SERVER_INSTRUCTIONS =
  'Servidor MCP de la API de Siigo (contabilidad/facturación Colombia). ' +
  'IMPORTANTE: al conectarte, invoca primero la herramienta `siigo_list_tools` para obtener el catálogo ' +
  'completo de herramientas disponibles agrupadas por dominio, con un resumen de qué hace cada una. ' +
  'Cada herramienta declara su contrato exacto en `inputSchema` (entradas) y `outputSchema` (salidas). ' +
  'Convenciones: las fechas usan formato YYYY-MM-DD; la paginación usa `page` y `page_size`; ' +
  'los listados devuelven `{ pagination, results, _links }` y toda respuesta viene envuelta en `{ success, data }`.';

export interface MCPServerOptions {
  siigoClient: SiigoClient;
  enableWriteTools: boolean;
}

export class MCPServer {
  private tools: Map<string, any> = new Map(); // eslint-disable-line @typescript-eslint/no-explicit-any
  private options: MCPServerOptions;

  constructor(options: MCPServerOptions) {
    this.options = options;
    this.registerAllTools();
  }

  private registerAllTools() {
    const { siigoClient, enableWriteTools } = this.options; // eslint-disable-line @typescript-eslint/no-unused-vars

    // Register all tool categories. enableWriteTools gates create/update/delete.
    registerCustomerTools(this.tools, siigoClient, enableWriteTools);
    registerInvoiceTools(this.tools, siigoClient, enableWriteTools);
    registerProductTools(this.tools, siigoClient, enableWriteTools);
    registerTaxTools(this.tools, siigoClient);
    registerUserTools(this.tools, siigoClient);
    registerPaymentTools(this.tools, siigoClient, enableWriteTools);
    registerCreditNoteTools(this.tools, siigoClient, enableWriteTools);
    registerJournalTools(this.tools, siigoClient, enableWriteTools);
    registerReportTools(this.tools, siigoClient);
    registerRawTools(this.tools, siigoClient);
    registerPurchaseTools(this.tools, siigoClient, enableWriteTools);
    registerQuotationTools(this.tools, siigoClient, enableWriteTools);
    registerSupportDocumentTools(this.tools, siigoClient, enableWriteTools);
    registerAccountGroupTools(this.tools, siigoClient, enableWriteTools);
    registerWebhookTools(this.tools, siigoClient, enableWriteTools);
    registerMetaTools(this.tools);

    logger.info({ toolCount: this.tools.size }, 'MCP tools registered');
  }

  /**
   * Create a fresh SDK Server instance wired to the registered tools.
   * One instance is created per transport/session (Streamable HTTP and SSE)
   * to avoid cross-session state.
   */
  createServer(): Server {
    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    });

    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolsList = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      }));

      logger.debug({ count: toolsList.length }, 'Listing tools');
      return { tools: toolsList };
    });

    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info({ tool: name }, 'Calling tool');

      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.handler(args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          // El SDK MCP exige structuredContent cuando la tool declara outputSchema;
          // sin esto, clientes como n8n rechazan la respuesta con -32600.
          ...(tool.outputSchema ? { structuredContent: result } : {}),
        };
      } catch (error) {
        logger.error({ tool: name, error }, 'Tool execution failed');
        throw error;
      }
    });

    return server;
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getSiigoClient(): SiigoClient {
    return this.options.siigoClient;
  }
}
