import logger from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries) {
        logger.error(
          { error, attempt: attempt + 1, maxRetries: opts.maxRetries },
          'All retry attempts failed'
        );
        break;
      }

      // Don't retry on client errors (4xx)
      if (isClientError(error)) {
        logger.warn({ error }, 'Client error - not retrying');
        throw error;
      }

      logger.warn(
        { error, attempt: attempt + 1, maxRetries: opts.maxRetries, delayMs: delay },
        'Request failed - retrying'
      );

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

function isClientError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    const status = err.response?.status || err.status;
    return status >= 400 && status < 500;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
