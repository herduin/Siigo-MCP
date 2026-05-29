import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withRetry } from '../../src/utils/retries';

describe('Retry Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });

    // Advance timers for retries
    vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100 });

    vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});
