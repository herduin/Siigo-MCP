import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

export interface MCPServerOptions {
  siigoClient: SiigoClient;
  enableWriteTools: boolean;
}

export class MCPServer {
  private server: Server;
  private tools: Map<string, any> = new Map();
  private options: MCPServerOptions;

  constructor(options: MCPServerOptions) {
    this.options = options;
    this.server = new Server(
      {
        name: 'siigo-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerAllTools();
    this.setupHandlers();
  }

  private registerAllTools() {
    const { siigoClient, enableWriteTools } = this.options; // eslint-disable-line @typescript-eslint/no-unused-vars

    // Register all tool categories
    registerCustomerTools(this.tools, siigoClient, enableWriteTools);
    registerInvoiceTools(this.tools, siigoClient, enableWriteTools);
    registerProductTools(this.tools, siigoClient);
    registerTaxTools(this.tools, siigoClient);
    registerUserTools(this.tools, siigoClient);
    registerPaymentTools(this.tools, siigoClient);
    registerCreditNoteTools(this.tools, siigoClient);
    registerJournalTools(this.tools, siigoClient);
    registerReportTools(this.tools, siigoClient);
    registerRawTools(this.tools, siigoClient);

    logger.info({ toolCount: this.tools.size }, 'MCP tools registered');
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolsList = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      logger.debug({ count: toolsList.length }, 'Listing tools');
      return { tools: toolsList };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
        };
      } catch (error) {
        logger.error({ tool: name, error }, 'Tool execution failed');
        throw error;
      }
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server running on stdio');
  }

  getServer() {
    return this.server;
  }

  getTools() {
    return Array.from(this.tools.values());
  }
}
