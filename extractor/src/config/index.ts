/**
 * Application configuration
 */

export interface AppConfig {
  nodeEnv: string;
  logLevel: string;
  rateLimitRps: number;
  httpTimeout: number;
  httpRetryAttempts: number;
  databaseUrl: string;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    rateLimitRps: parseInt(process.env.RATE_LIMIT_RPS || '2', 10),
    httpTimeout: parseInt(process.env.HTTP_TIMEOUT || '30000', 10),
    httpRetryAttempts: parseInt(process.env.HTTP_RETRY_ATTEMPTS || '3', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://events:events@localhost:5432/events',
  };
}
