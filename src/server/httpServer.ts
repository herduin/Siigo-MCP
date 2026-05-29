import express, { Request, Response } from 'express';
import { MCPServer } from './mcpServer.js';
import { createAuthMiddleware } from './authMiddleware.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import logger from '../utils/logger.js';

export interface HttpServerConfig {
  port: number;
  mcpPath: string;
  authToken?: string;
  maxPayloadSize: string;
}

export class HttpServer {
  private app: express.Application;
  private mcpServer: MCPServer;
  private config: HttpServerConfig;

  constructor(mcpServer: MCPServer, config: HttpServerConfig) {
    this.mcpServer = mcpServer;
    this.config = config;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: this.config.maxPayloadSize }));
    this.app.use(express.urlencoded({ extended: true, limit: this.config.maxPayloadSize }));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.info({ method: req.method, path: req.path }, 'HTTP request');
      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    });

    // Readiness check endpoint
    this.app.get('/ready', async (_req: Request, res: Response) => {
      try {
        const siigoHealthy = await this.mcpServer['options'].siigoClient.healthCheck();
        if (siigoHealthy) {
          res.json({
            status: 'ready',
            siigo: 'connected',
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({
            status: 'not ready',
            siigo: 'disconnected',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: 'health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Version endpoint
    this.app.get('/version', (_req: Request, res: Response) => {
      res.json({
        name: 'siigo-mcp-server',
        version: '1.0.0',
        mcp: {
          path: this.config.mcpPath,
          tools: this.mcpServer.getTools().length,
        },
      });
    });

    // MCP endpoint with auth middleware
    const authMiddleware = createAuthMiddleware(this.config.authToken);
    this.app.post(this.config.mcpPath, authMiddleware, async (req: Request, res: Response) => {
      try {
        const jsonrpcRequest = req.body;

        // Validate JSON-RPC request
        if (!jsonrpcRequest.jsonrpc || jsonrpcRequest.jsonrpc !== '2.0') {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid JSON-RPC request - missing or invalid jsonrpc field',
            },
            id: jsonrpcRequest.id || null,
          });
        }

        // Handle initialize request
        if (jsonrpcRequest.method === 'initialize') {
          return res.json({
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'siigo-mcp-server',
                version: '1.0.0',
              },
            },
            id: jsonrpcRequest.id,
          });
        }

        // Handle tools/list request
        if (jsonrpcRequest.method === 'tools/list') {
          const tools = this.mcpServer.getTools().map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }));

          return res.json({
            jsonrpc: '2.0',
            result: {
              tools,
            },
            id: jsonrpcRequest.id,
          });
        }

        // Handle tools/call request
        if (jsonrpcRequest.method === 'tools/call') {
          const { name, arguments: args } = jsonrpcRequest.params || {};

          if (!name) {
            return res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Invalid params - missing tool name',
              },
              id: jsonrpcRequest.id,
            });
          }

          const tool = this.mcpServer.getTools().find((t) => t.name === name);
          if (!tool) {
            return res.status(404).json({
              jsonrpc: '2.0',
              error: {
                code: -32601,
                message: `Tool not found: ${name}`,
              },
              id: jsonrpcRequest.id,
            });
          }

          try {
            const result = await tool.handler(args || {});
            return res.json({
              jsonrpc: '2.0',
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
              id: jsonrpcRequest.id,
            });
          } catch (error) {
            logger.error({ tool: name, error }, 'Tool execution failed');
            return res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: (error as Error).message || 'Tool execution failed',
              },
              id: jsonrpcRequest.id,
            });
          }
        }

        // Unknown method
        return res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${jsonrpcRequest.method}`,
          },
          id: jsonrpcRequest.id || null,
        });
      } catch (error) {
        logger.error({ error }, 'MCP request processing failed');
        return res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
          },
          id: null,
        });
      }
    });
  }

  private setupErrorHandlers() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  start() {
    return new Promise<void>((resolve) => {
      this.app.listen(this.config.port, () => {
        logger.info(
          {
            port: this.config.port,
            mcpPath: this.config.mcpPath,
            authEnabled: !!this.config.authToken,
          },
          'HTTP server started'
        );
        resolve();
      });
    });
  }

  getApp() {
    return this.app;
  }
}
