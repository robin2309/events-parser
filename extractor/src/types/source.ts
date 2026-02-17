/**
 * Metadata about an event source/adapter
 */
export interface SourceMeta {
  /** Unique adapter name (e.g., "exampleVenue") */
  adapterName: string;

  /** Base URL of the source */
  baseUrl: string;

  /** Optional: human-readable display name */
  displayName?: string;

  /** Optional: refresh interval group (0-3) for rolling schedule */
  refreshGroup?: 0 | 1 | 2 | 3;
}

/**
 * Execution context passed to adapter methods
 */
export interface AdapterContext {
  /** Logger instance */
  logger: Logger;

  /** HTTP client wrapper */
  http: HttpClient;

  /** Current timestamp function */
  now: () => Date;

  /** Optional rate limiter hook */
  rateLimiter?: RateLimiter;
}

/**
 * Simple logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * HTTP client abstraction
 */
export interface HttpClient {
  get(url: string, options?: HttpOptions): Promise<HttpResponse>;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  waitForSlot(): Promise<void>;
}
