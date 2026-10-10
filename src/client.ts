import { KanApiError } from './errors.js';

const DEBUG = process.env.DEBUG === 'true';

function debug(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, ...args);
  }
}

export class KanClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetries: number;

  constructor(apiKey: string, baseUrl?: string, defaultTimeoutMs?: number, defaultRetries?: number) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || process.env.KAN_API_BASE_URL || 'https://kan.bn/api/v1';
    this.defaultTimeoutMs = defaultTimeoutMs ?? 30000;
    this.defaultRetries = defaultRetries ?? 3;
  }

  async request<T>(path: string, options?: RequestInit & { timeout?: number; retries?: number }): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    const timeout = options?.timeout ?? this.defaultTimeoutMs;
    const maxRetries = options?.retries ?? this.defaultRetries;

    debug(`Request: ${options?.method ?? 'GET'} ${url}`);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        debug(`Attempt ${attempt + 1}/${maxRetries + 1}`);

        const response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...options?.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        debug(`Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          throw KanApiError.fromHttpStatus(response.status, response.statusText);
        }

        const data = await response.json() as T;
        debug(`Success for ${path}`);
        return data;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          debug(`Timeout after ${timeout}ms for ${path}`);
          lastError = new Error(`Request timeout after ${timeout}ms`);
        } else if (attempt < maxRetries && this.isRetryableError(error)) {
          debug(`Retryable error, retrying: ${error}`);
          lastError = error as Error;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          debug(`Waiting ${delay}ms before retry`);
          await this.sleep(delay);
          continue;
        } else if (error instanceof Error) {
          debug(`Non-retryable error: ${error.message}`);
          lastError = error;
        } else {
          lastError = new Error(String(error));
        }
        break;
      }
    }

    throw lastError || new Error('Request failed');
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof KanApiError) {
      return error.status >= 500 || error.status === 429;
    }
    if (error instanceof TypeError) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}