import { describe, it, expect } from 'vitest';
import { ExampleVenueAdapter } from '../src/adapters/exampleVenue.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { FetchHttpClient } from '../src/utils/http.js';

describe('Adapter Contract', () => {
  const mockLogger: Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const mockContext: AdapterContext = {
    logger: mockLogger,
    http: new FetchHttpClient(),
    now: () => new Date(),
  };

  it('should have required meta properties', () => {
    const adapter = new ExampleVenueAdapter();

    expect(adapter.meta).toBeDefined();
    expect(adapter.meta.adapterName).toBe('exampleVenue');
    expect(adapter.meta.baseUrl).toBe('https://example-venue.com');
    expect(typeof adapter.meta.adapterName).toBe('string');
    expect(typeof adapter.meta.baseUrl).toBe('string');
  });

  it('should implement discover method', async () => {
    const adapter = new ExampleVenueAdapter();

    const urls = await adapter.discover(mockContext);

    expect(Array.isArray(urls)).toBe(true);
  });

  it('should implement extract method', async () => {
    const adapter = new ExampleVenueAdapter();

    const events = await adapter.extract(
      mockContext,
      'https://example-venue.com/event/123',
      '<html><body>Test</body></html>'
    );

    expect(Array.isArray(events)).toBe(true);

    if (events.length > 0) {
      const event = events[0];

      // Validate required fields
      expect(event.sourceId).toBeDefined();
      expect(event.eventUrl).toBeDefined();
      expect(event.title).toBeDefined();
      expect(event.startAt).toBeDefined();
      expect(event.timezone).toBeDefined();
      expect(event.fetchedAt).toBeDefined();
      expect(event.lastSeenAt).toBeDefined();
      expect(event.contentHash).toBeDefined();

      // Validate types
      expect(typeof event.sourceId).toBe('string');
      expect(typeof event.eventUrl).toBe('string');
      expect(typeof event.title).toBe('string');
      expect(typeof event.startAt).toBe('string');
      expect(typeof event.timezone).toBe('string');
      expect(typeof event.contentHash).toBe('string');
    }
  });
});
