/**
 * Events Aggregator - Main entry point
 */

export { BaseAdapter } from './adapters/base.js';
export { adapterRegistry, AdapterRegistry } from './adapters/registry.js';
export type { NormalizedEvent, RawEventData } from './types/event.js';
export type {
  SourceMeta,
  AdapterContext,
  Logger,
  HttpClient,
  HttpOptions,
  HttpResponse,
  RateLimiter,
} from './types/source.js';
export { extractJsonLdEvents } from './extractors/jsonld.js';
export { FetchHttpClient } from './utils/http.js';
export { generateContentHash, generateEventId } from './utils/hashing.js';
export { parseIsoDate, toIsoString, isValidTimezone } from './utils/dates.js';
export { loadConfig } from './config/index.js';
