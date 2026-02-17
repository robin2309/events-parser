import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';

/**
 * Abstract base adapter class enforcing the adapter contract
 */
export abstract class BaseAdapter {
  /** Adapter metadata */
  abstract readonly meta: SourceMeta;

  /**
   * Discover event URLs from listing pages
   * @returns Array of event detail page URLs
   */
  abstract discover(ctx: AdapterContext): Promise<string[]>;

  /**
   * Extract normalized events from a detail page
   * @param ctx - Adapter context
   * @param eventUrl - The event detail URL
   * @param html - Raw HTML content
   * @returns Array of normalized events (typically 1)
   */
  abstract extract(
    ctx: AdapterContext,
    eventUrl: string,
    html: string
  ): Promise<NormalizedEvent[]>;

  /**
   * Helper: Generate ISO timestamp
   */
  protected getIsoTimestamp(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Helper: Normalize URL (resolve relative paths, clean query params)
   */
  protected normalizeUrl(url: string, baseUrl?: string): string {
    try {
      return new URL(url, baseUrl || this.meta.baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * Helper: Log adapter action
   */
  protected log(ctx: AdapterContext, level: 'debug' | 'info' | 'warn' | 'error', message: string) {
    ctx.logger[level](`[${this.meta.adapterName}] ${message}`);
  }
}
