import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Example venue adapter (placeholder implementation)
 */
export class ExampleVenueAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'exampleVenue',
    baseUrl: 'https://example-venue.com',
    displayName: 'Example Venue',
    refreshGroup: 0,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    this.log(ctx, 'info', 'Starting discovery (placeholder - returns empty)');

    // Placeholder: In real implementation, would fetch listing pages
    // and extract event detail URLs

    return [];
  }

  async extract(
    ctx: AdapterContext,
    eventUrl: string,
    _html: string
  ): Promise<NormalizedEvent[]> {
    this.log(ctx, 'info', `Extracting event from ${eventUrl} (placeholder)`);

    // Placeholder: In real implementation, would parse HTML and extract event data

    const now = ctx.now();
    const isoNow = this.getIsoTimestamp(now);

    // Example structure (not real data)
    const event: NormalizedEvent = {
      sourceId: this.meta.adapterName,
      sourceEventId: null,
      eventUrl: this.normalizeUrl(eventUrl),
      title: 'Placeholder Event',
      description: 'This is a placeholder event from the scaffold',
      startAt: isoNow,
      endAt: null,
      timezone: 'UTC',
      imageUrl: null,
      locationName: null,
      locationAddress: null,
      status: 'active',
      fetchedAt: isoNow,
      lastSeenAt: isoNow,
      contentHash: generateContentHash({
        title: 'Placeholder Event',
        startAt: isoNow,
      }),
    };

    return [event];
  }
}
