import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function createAuthMiddleware(authToken?: string) {
  if (!authToken) {
    logger.info('MCP auth disabled - no auth token configured');
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  logger.info('MCP auth enabled');

  return (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
      logger.warn('Request missing authorization header');
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized - missing authorization header',
        },
        id: null,
      });
    }

    const expectedBearer = `Bearer ${authToken}`;
    if (authorization !== expectedBearer) {
      logger.warn('Invalid authorization token');
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized - invalid token',
        },
        id: null,
      });
    }

    next();
  };
}
