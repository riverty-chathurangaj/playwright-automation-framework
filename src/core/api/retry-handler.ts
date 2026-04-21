import { logger } from '@shared-core/logger';

export interface RetryOptions<T> {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryOn?: (error: Error | null, result?: T) => boolean;
  onRetry?: (attempt: number, error: Error | null, result?: T) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions<unknown>, 'retryOn' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  jitter: true,
};

export class RetryHandler {
  private options: typeof DEFAULT_OPTIONS;

  constructor(options: Partial<typeof DEFAULT_OPTIONS> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private calculateDelay(attempt: number): number {
    const baseDelay = Math.min(
      this.options.initialDelayMs * Math.pow(this.options.backoffMultiplier, attempt - 1),
      this.options.maxDelayMs,
    );

    if (this.options.jitter) {
      const jitterFactor = 0.8 + Math.random() * 0.4;
      return Math.floor(baseDelay * jitterFactor);
    }

    return baseDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async execute<T>(operation: () => Promise<T>, options?: RetryOptions<T>): Promise<T> {
    const { maxRetries } = { ...this.options, ...options };
    const shouldRetry = options?.retryOn;
    const onRetry = options?.onRetry;

    let lastError: Error | null = null;
    let lastResult: T | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await operation();
        lastResult = result;

        if (attempt <= maxRetries && shouldRetry && shouldRetry(null, result)) {
          logger.warn('Retrying based on result condition', {
            attempt,
            maxRetries,
          });
          onRetry?.(attempt, null, result);
          await this.delay(this.calculateDelay(attempt));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt > maxRetries) break;

        const doRetry = shouldRetry ? shouldRetry(lastError, undefined) : true;
        if (!doRetry) break;

        const delayMs = this.calculateDelay(attempt);
        logger.warn('Retrying after error', {
          attempt,
          maxRetries,
          delayMs,
          error: lastError.message,
        });

        onRetry?.(attempt, lastError, undefined);
        await this.delay(delayMs);
      }
    }

    if (lastError) throw lastError;
    return lastResult as T;
  }

  async poll<T>(
    operation: () => Promise<T>,
    condition: (result: T) => boolean,
    timeoutMs: number = 30_000,
    intervalMs: number = 500,
  ): Promise<T> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const result = await operation();
      if (condition(result)) return result;
      await this.delay(intervalMs);
    }

    throw new Error(`Polling timed out after ${timeoutMs}ms`);
  }
}
