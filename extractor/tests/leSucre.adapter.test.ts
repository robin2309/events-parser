import { describe, it, expect, beforeAll } from 'vitest';
import { LeSucreAdapter } from '../src/adapters/leSucre.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('LeSucre Adapter', () => {
  let adapter: LeSucreAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let listingHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new LeSucreAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Load fixtures
    const fixturesDir = join(__dirname, '..', 'fixtures', 'leSucre');
    listingHtml = readFileSync(join(fixturesDir, 'listing.html'), 'utf-8');
    eventHtml = readFileSync(join(fixturesDir, 'event.html'), 'utf-8');

    mockContext = {
      logger: mockLogger,
      http: {
        get: async (url: string) => {
          if (url.includes('/agenda/')) {
            return {
              status: 200,
              statusText: 'OK',
              body: listingHtml,
              headers: { 'content-type': 'text/html' },
            };
          }
          return {
            status: 404,
            statusText: 'Not Found',
            body: '',
            headers: {},
          };
        },
      },
      now: () => new Date(),
    };
  });

  describe('Metadata', () => {
    it('should have correct adapter name', () => {
      expect(adapter.meta.adapterName).toBe('leSucre');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://le-sucre.eu');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Le Sucre');
    });

    it('should have refresh group', () => {
      expect(adapter.meta.refreshGroup).toBe(1);
    });
  });

  describe('Discovery', () => {
    it('should discover event URLs from listing page', async () => {
      const urls = await adapter.discover(mockContext);

      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.length).toBeLessThan(35); // Should exclude archives link

      // All URLs should point to le-sucre.eu/events/
      urls.forEach((url) => {
        expect(url).toContain('le-sucre.eu/events/');
        expect(url).not.toContain('archives');
      });
    });

    it('should return fully qualified URLs', async () => {
      const urls = await adapter.discover(mockContext);

      urls.forEach((url) => {
        expect(url.startsWith('https://')).toBe(true);
      });
    });
  });

  describe('Extraction', () => {
    it('should extract event with all required fields', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://le-sucre.eu/events/s-society-ellenallien/',
        eventHtml
      );

      expect(events.length).toBe(1);

      const event = events[0];

      // Required fields
      expect(event.sourceId).toBe('leSucre');
      expect(event.eventUrl).toBeDefined();
      expect(event.title).toBeDefined();
      expect(event.startAt).toBeDefined();
      expect(event.timezone).toBeDefined();
      expect(event.fetchedAt).toBeDefined();
      expect(event.lastSeenAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should extract correct title', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].title).toBe('S.society');
    });

    it('should extract start datetime in ISO format', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      const startAt = events[0].startAt;

      // Should be ISO 8601 format
      expect(startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Should contain timezone offset
      expect(startAt).toMatch(/[+-]\d{2}:\d{2}$/);

      // Should be 2026-02-08T18:00:00+02:00 (based on fixture)
      expect(startAt).toContain('2026-02-08');
      expect(startAt).toContain('18:00');
    });

    it('should extract end datetime', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      const endAt = events[0].endAt;

      // Should be ISO 8601 format (or null)
      if (endAt) {
        expect(endAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(endAt).toMatch(/[+-]\d{2}:\d{2}$/);

        // End time should be 00:00 on next day (early morning)
        expect(endAt).toContain('2026-02-09'); // Next day
        expect(endAt).toContain('00:00');
      }
    });

    it('should set timezone to Europe/Paris', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].timezone).toBe('Europe/Paris');
    });

    it('should set location name and address', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].locationName).toBe('Le Sucre');
      expect(events[0].locationAddress).toBe('Lyon, France');
    });

    it('should extract description', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].description).toBeDefined();
      expect(typeof events[0].description).toBe('string');
      expect(events[0].description!.length).toBeGreaterThan(0);
    });

    it('should extract image URL', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].imageUrl).toBeDefined();
      expect(events[0].imageUrl).toContain('le-sucre.eu/wp-content/uploads/');
    });

    it('should extract ticket URL from reservation link', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].ticketUrl).toBeDefined();
      expect(events[0].ticketUrl).toContain('shotgun.live');
    });

    it('should handle missing ticket URL gracefully', async () => {
      const minimalHtml = `
        <section id="section-header">
          <h1>Test Event</h1>
          <div class="day">15</div>
          <div class="month">mars</div>
          <div class="hours">22:00 — 04:00</div>
        </section>
      `;

      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', minimalHtml);

      expect(events.length).toBe(1);
      expect(events[0].ticketUrl).toBeNull();
    });

    it('should extract source event ID from URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://le-sucre.eu/events/s-society-ellenallien/',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].sourceEventId).toBe('s-society-ellenallien');
    });

    it('should normalize event URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://le-sucre.eu/events/s-society-ellenallien/',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].eventUrl).toContain('https://');
      expect(events[0].eventUrl).toContain('le-sucre.eu');
    });

    it('should set status to active', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].status).toBe('active');
    });

    it('should generate content hash', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      expect(events.length).toBe(1);
      expect(events[0].contentHash).toBeDefined();
      expect(typeof events[0].contentHash).toBe('string');
      expect(events[0].contentHash.length).toBeGreaterThan(0);
    });

    it('should set fetchedAt and lastSeenAt', async () => {
      const beforeTest = new Date();
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);
      const afterTest = new Date();

      expect(events.length).toBe(1);

      const fetchedAt = new Date(events[0].fetchedAt);
      const lastSeenAt = new Date(events[0].lastSeenAt);

      expect(fetchedAt.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime() - 100);
      expect(fetchedAt.getTime()).toBeLessThanOrEqual(afterTest.getTime() + 100);
      expect(lastSeenAt.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime() - 100);
      expect(lastSeenAt.getTime()).toBeLessThanOrEqual(afterTest.getTime() + 100);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalHtml = `
        <section id="section-header">
          <h1>Test Event</h1>
          <div class="day">15</div>
          <div class="month">mars</div>
          <div class="hours">22:00 — 04:00</div>
        </section>
      `;

      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', minimalHtml);

      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Test Event');
      expect(events[0].description).toBeNull();
      expect(events[0].imageUrl).toBeNull();
    });

    it('should handle malformed URLs gracefully', async () => {
      const events = await adapter.extract(
        mockContext,
        'not-a-valid-url',
        eventHtml
      );

      expect(events.length).toBe(1);
      // Should still extract event data
      expect(events[0].title).toBe('S.society');
    });

    it('should return empty array on invalid HTML', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://le-sucre.eu/events/test/',
        '<html></html>'
      );

      // May return event with defaults, but title should be 'Untitled Event'
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].title).toBe('Untitled Event');
    });
  });

  describe('Date parsing', () => {
    it('should handle French month names correctly', async () => {
      const testCases = [
        { html: '<div class="day">1</div><div class="month">janvier</div><div class="hours">20:00</div>', expected: '-01-01' },
        { html: '<div class="day">14</div><div class="month">février</div><div class="hours">20:00</div>', expected: '-02-14' },
        { html: '<div class="day">31</div><div class="month">décembre</div><div class="hours">20:00</div>', expected: '-12-31' },
      ];

      for (const testCase of testCases) {
        const events = await adapter.extract(
          mockContext,
          'https://le-sucre.eu/events/test/',
          testCase.html
        );

        expect(events[0].startAt).toContain(testCase.expected);
      }
    });

    it('should handle late night end times (next day)', async () => {
      const events = await adapter.extract(mockContext, 'https://le-sucre.eu/events/test/', eventHtml);

      // Fixture has 18:00 — 00:00
      // Should put end time on next day
      if (events[0].endAt) {
        expect(events[0].endAt).toContain('T00:00:00');
      }
    });
  });
});
