import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ error: err }, 'Request error');

  // JSON-RPC error response
  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: err.message || 'Internal server error',
    },
    id: null,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  logger.warn({ path: req.path }, 'Route not found');

  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
}
