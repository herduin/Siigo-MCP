import dotenv from 'dotenv';
import { SiigoClient } from './siigo/siigoClient.js';
import { MCPServer } from './server/mcpServer.js';
import { HttpServer } from './server/httpServer.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  // Server
  port: parseInt(process.env.PORT || '3230', 10),
  mcpPath: process.env.MCP_PATH || '/mcp',
  mcpAuthToken: process.env.MCP_AUTH_TOKEN,
  maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb',

  // Siigo API
  siigo: {
    baseUrl: process.env.SIIGO_BASE_URL || 'https://api.siigo.com',
    username: process.env.SIIGO_USERNAME || '',
    accessKey: process.env.SIIGO_ACCESS_KEY || '',
    partnerId: process.env.SIIGO_PARTNER_ID,
    timeoutMs: parseInt(process.env.SIIGO_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.SIIGO_MAX_RETRIES || '3', 10),
  },

  // Features
  enableWriteTools: process.env.ENABLE_WRITE_TOOLS === 'true',
};

async function main() {
  logger.info({ config: { ...config, siigo: { ...config.siigo, username: '***', accessKey: '***' } } }, 'Starting Siigo MCP Server');

  // Validate required configuration
  if (!config.siigo.username || !config.siigo.accessKey) {
    logger.error('Missing required Siigo credentials (SIIGO_USERNAME and SIIGO_ACCESS_KEY)');
    process.exit(1);
  }

  try {
    // Initialize Siigo client
    const siigoClient = new SiigoClient(config.siigo);

    // Test Siigo connection
    logger.info('Testing Siigo API connection...');
    const healthy = await siigoClient.healthCheck();
    if (!healthy) {
      logger.error('Failed to connect to Siigo API - check credentials');
      process.exit(1);
    }
    logger.info('Siigo API connection successful');

    // Initialize MCP server
    const mcpServer = new MCPServer({
      siigoClient,
      enableWriteTools: config.enableWriteTools,
    });

    // Initialize HTTP server
    const httpServer = new HttpServer(mcpServer, {
      port: config.port,
      mcpPath: config.mcpPath,
      authToken: config.mcpAuthToken,
      maxPayloadSize: config.maxPayloadSize,
    });

    // Start HTTP server
    await httpServer.start();

    logger.info(
      {
        port: config.port,
        mcpPath: config.mcpPath,
        toolsCount: mcpServer.getTools().length,
        writeToolsEnabled: config.enableWriteTools,
      },
      'Siigo MCP Server started successfully'
    );

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
