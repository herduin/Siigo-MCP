import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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

  // Active transports keyed by session id
  private streamableTransports: Map<string, StreamableHTTPServerTransport> = new Map();
  private sseTransports: Map<string, SSEServerTransport> = new Map();

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
    this.setupHealthRoutes();
    this.setupStreamableHttpRoutes();
    this.setupSseRoutes();
  }

  private setupHealthRoutes() {
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
        const siigoHealthy = await this.mcpServer.getSiigoClient().healthCheck();
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
      } catch {
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
          transports: ['streamable-http', 'sse'],
          tools: this.mcpServer.getTools().length,
        },
      });
    });
  }

  /**
   * Modern MCP transport: Streamable HTTP (stateful, with Mcp-Session-Id).
   * Handles POST (messages), GET (server->client SSE stream) and DELETE (close).
   */
  private setupStreamableHttpRoutes() {
    const authMiddleware = createAuthMiddleware(this.config.authToken);
    const path = this.config.mcpPath;

    // POST: client -> server messages (and session bootstrap on initialize)
    this.app.post(path, authMiddleware, async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport = sessionId ? this.streamableTransports.get(sessionId) : undefined;

        if (!transport && isInitializeRequest(req.body)) {
          // New session
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              this.streamableTransports.set(sid, transport!);
              logger.info({ sessionId: sid }, 'Streamable HTTP session initialized');
            },
          });

          transport.onclose = () => {
            if (transport!.sessionId) {
              this.streamableTransports.delete(transport!.sessionId);
              logger.info({ sessionId: transport!.sessionId }, 'Streamable HTTP session closed');
            }
          };

          const server = this.mcpServer.createServer();
          await server.connect(transport);
        }

        if (!transport) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: no valid session ID provided',
            },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error({ error }, 'Streamable HTTP POST failed');
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          });
        }
      }
    });

    // GET: server -> client SSE stream for an existing session
    this.app.get(path, authMiddleware, async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const transport = sessionId ? this.streamableTransports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      await transport.handleRequest(req, res);
    });

    // DELETE: terminate a session
    this.app.delete(path, authMiddleware, async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const transport = sessionId ? this.streamableTransports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      await transport.handleRequest(req, res);
    });
  }

  /**
   * Legacy MCP transport: HTTP+SSE (protocol 2024-11-05).
   * GET /sse opens the stream, POST /messages?sessionId=... delivers messages.
   * Kept for older clients (e.g. some n8n versions) that don't speak Streamable HTTP.
   */
  private setupSseRoutes() {
    const authMiddleware = createAuthMiddleware(this.config.authToken);

    this.app.get('/sse', authMiddleware, async (_req: Request, res: Response) => {
      const transport = new SSEServerTransport('/messages', res);
      this.sseTransports.set(transport.sessionId, transport);
      logger.info({ sessionId: transport.sessionId }, 'SSE session opened');

      res.on('close', () => {
        this.sseTransports.delete(transport.sessionId);
        logger.info({ sessionId: transport.sessionId }, 'SSE session closed');
      });

      const server = this.mcpServer.createServer();
      await server.connect(transport);
    });

    this.app.post('/messages', authMiddleware, async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string | undefined;
      const transport = sessionId ? this.sseTransports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).send('No transport found for sessionId');
        return;
      }
      await transport.handlePostMessage(req, res, req.body);
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
