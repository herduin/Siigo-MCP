import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

export const logger = pino({
  level: LOG_LEVEL,
  transport:
    NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'siigo.username',
      'siigo.access_key',
      'siigo.partner_id',
      'config.username',
      'config.access_key',
      'config.partner_id',
      'authorization',
      'password',
      'token',
      'access_token',
    ],
    remove: true,
  },
});

export default logger;
