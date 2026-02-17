import type { HttpClient, HttpOptions, HttpResponse } from '../types/source.js';

/**
 * Simple HTTP client wrapper around fetch
 */
export class FetchHttpClient implements HttpClient {
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor(timeout = 30000, retries = 3) {
    this.defaultTimeout = timeout;
    this.defaultRetries = retries;
  }

  async get(url: string, options?: HttpOptions): Promise<HttpResponse> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const retries = options?.retries ?? this.defaultRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          headers: options?.headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const body = await response.text();

        return {
          status: response.status,
          statusText: response.statusText,
          body,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('HTTP request failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
