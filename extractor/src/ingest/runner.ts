import type { AdapterContext, Logger } from '../types/source.js';
import { FetchHttpClient } from '../utils/http.js';
import { adapterRegistry } from '../adapters/registry.js';
import { upsertEvents } from '../db/upsertEvents.js';
import { closePool } from '../db/pool.js';

/**
 * Console logger implementation
 */
class ConsoleLogger implements Logger {
  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }
  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

/**
 * Run ingestion for a specific adapter (stub)
 */
export async function runSource(adapterName: string): Promise<void> {
  const logger = new ConsoleLogger();

  logger.info(`[Runner] Starting ingestion for source: ${adapterName}`);

  const adapter = adapterRegistry.get(adapterName);

  if (!adapter) {
    logger.error(`[Runner] Adapter not found: ${adapterName}`);
    logger.info(`[Runner] Available adapters: ${adapterRegistry.listNames().join(', ')}`);
    return;
  }

  const ctx = createContext(logger);

  try {
    logger.info(`[Runner] Discovering events for ${adapter.meta.adapterName}...`);
    const eventUrls = await adapter.discover(ctx);
    logger.info(`[Runner] Discovered ${eventUrls.length} event URLs`);

    let totalUpserted = 0;

    for (const url of eventUrls) {
      try {
        const res = await ctx.http.get(url);
        const events = await adapter.extract(ctx, url, res.body);

        if (events.length > 0) {
          const count = await upsertEvents(events);
          totalUpserted += count;
          logger.info(`[Runner] Upserted ${count} event(s) from ${url}`);
        }
      } catch (err) {
        logger.error(`[Runner] Failed to process ${url}: ${err}`);
      }
    }

    logger.info(`[Runner] Completed ${adapterName}: ${totalUpserted} events upserted`);
  } catch (error) {
    logger.error(`[Runner] Error during ingestion: ${error}`);
  }
}

/**
 * Run ingestion for all adapters in a refresh group (stub)
 */
export async function runGroup(group: 0 | 1 | 2 | 3): Promise<void> {
  const logger = new ConsoleLogger();

  logger.info(`[Runner] Starting ingestion for group ${group}`);

  const adapters = adapterRegistry.getByGroup(group);

  if (adapters.length === 0) {
    logger.warn(`[Runner] No adapters found in group ${group}`);
    return;
  }

  logger.info(`[Runner] Found ${adapters.length} adapters in group ${group}`);

  for (const adapter of adapters) {
    await runSource(adapter.meta.adapterName);
  }

  logger.info(`[Runner] Completed ingestion for group ${group}`);
  await closePool();
}

/**
 * Create adapter context
 */
function createContext(logger: Logger): AdapterContext {
  return {
    logger,
    http: new FetchHttpClient(),
    now: () => new Date(),
  };
}
