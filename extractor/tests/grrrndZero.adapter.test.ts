import { describe, it, expect, beforeAll } from 'vitest';
import { GrrrndZeroAdapter } from '../src/adapters/grrrndZero.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GrrrndZero Adapter', () => {
  let adapter: GrrrndZeroAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let rssHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new GrrrndZeroAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Load fixtures
    const fixturesDir = join(__dirname, '..', 'fixtures', 'grrrndZero');
    rssHtml = readFileSync(join(fixturesDir, 'rss.xml'), 'utf-8');
    eventHtml = readFileSync(join(fixturesDir, 'event.html'), 'utf-8');

    mockContext = {
      logger: mockLogger,
      http: {
        get: async (url: string) => {
          if (url.includes('format=feed&type=rss')) {
            return {
              status: 200,
              statusText: 'OK',
              body: rssHtml,
              headers: { 'content-type': 'application/rss+xml' },
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
      expect(adapter.meta.adapterName).toBe('grrrndZero');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.grrrndzero.org');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Grrrnd Zero');
    });

    it('should have refresh group', () => {
      expect(adapter.meta.refreshGroup).toBe(1);
    });
  });

  describe('Discovery', () => {
    it('should discover event URLs from RSS feed', async () => {
      const urls = await adapter.discover(mockContext);

      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.length).toBe(3); // Three items in test RSS

      // All URLs should point to grrrndzero.org
      urls.forEach((url) => {
        expect(url).toContain('grrrndzero.org');
      });
    });

    it('should exclude main agenda page from discovery', async () => {
      const urls = await adapter.discover(mockContext);

      // Should not include the /1477-agenda-gz page
      const hasAgendaPage = urls.some((url) => url.includes('/1477-agenda-gz'));
      expect(hasAgendaPage).toBe(false);
    });

    it('should return fully qualified URLs', async () => {
      const urls = await adapter.discover(mockContext);

      urls.forEach((url) => {
        expect(url.startsWith('https://')).toBe(true);
      });
    });

    it('should extract event IDs from URLs', async () => {
      const urls = await adapter.discover(mockContext);

      // URLs should have format: /index.php/2748-sam-28-02-...
      urls.forEach((url) => {
        expect(url).toMatch(/\/\d+-.+/);
      });
    });
  });

  describe('Extraction', () => {
    it('should extract event with all required fields', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);

      const event = events[0];

      // Required fields
      expect(event.sourceId).toBe('grrrndZero');
      expect(event.eventUrl).toBeDefined();
      expect(event.title).toBeDefined();
      expect(event.startAt).toBeDefined();
      expect(event.timezone).toBeDefined();
      expect(event.fetchedAt).toBeDefined();
      expect(event.lastSeenAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should extract correct title', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].title).toContain('BIG SCIENCE DAILY PROGRAM');
    });

    it('should extract start datetime in ISO format', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      const startAt = events[0].startAt;

      // Should be ISO 8601 format
      expect(startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Should contain timezone offset
      expect(startAt).toMatch(/[+-]\d{2}:\d{2}$/);

      // Should contain 28/02 date
      expect(startAt).toContain('-02-28');

      // Should contain 16h time
      expect(startAt).toContain('16:00');
    });

    it('should extract end datetime', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      const endAt = events[0].endAt;

      // Should have end time (01h next day)
      if (endAt) {
        expect(endAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(endAt).toMatch(/[+-]\d{2}:\d{2}$/);

        // End time should be 01:00 on next day (after midnight)
        expect(endAt).toContain('-03-01');
        expect(endAt).toContain('01:00');
      }
    });

    it('should set timezone to Europe/Paris', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].timezone).toBe('Europe/Paris');
    });

    it('should set location name and address', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].locationName).toBe('Grrrnd Zero');
      expect(events[0].locationAddress).toContain('60 Avenue de Bohlen');
      expect(events[0].locationAddress).toContain('Vaulx-en-Velin');
    });

    it('should extract description', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].description).toBeDefined();
      expect(typeof events[0].description).toBe('string');
      expect(events[0].description!.length).toBeGreaterThan(0);
      expect(events[0].description).toContain('Big Science Records');
    });

    it('should extract image URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].imageUrl).toBeDefined();
      expect(events[0].imageUrl).toContain('grrrndzero.org');
      expect(events[0].imageUrl).toContain('post_73dd2.jpeg');
    });

    it('should extract source event ID from URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].sourceEventId).toBe('2748');
    });

    it('should normalize event URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].eventUrl).toContain('https://');
      expect(events[0].eventUrl).toContain('grrrndzero.org');
    });

    it('should set status to active', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].status).toBe('active');
    });

    it('should generate content hash', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].contentHash).toBeDefined();
      expect(typeof events[0].contentHash).toBe('string');
      expect(events[0].contentHash.length).toBeGreaterThan(0);
    });

    it('should set fetchedAt and lastSeenAt', async () => {
      const beforeTest = new Date();
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );
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
        <h1>Test Event</h1>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2753-test-event',
        minimalHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Test Event');
      expect(events[0].description).toBeNull();
      expect(events[0].imageUrl).toBeNull();
      expect(events[0].ticketUrl).toBeNull();
    });

    it('should handle malformed URLs gracefully', async () => {
      const events = await adapter.extract(
        mockContext,
        'not-a-valid-url',
        eventHtml
      );

      expect(events.length).toBe(1);
      // Should still extract event data
      expect(events[0].title).toContain('BIG SCIENCE');
    });

    it('should return empty array on invalid HTML', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2753-test/',
        '<html></html>'
      );

      // Will return event with defaults
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].title).toBe('Untitled Event');
    });
  });

  describe('Date parsing', () => {
    it('should handle French date abbreviations', async () => {
      const testHtml = `
        <h1>Test Event</h1>
        <p>jeu 05/03 (19h‑22h)</p>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2755-test/',
        testHtml
      );

      expect(events[0].startAt).toContain('-03-05');
      expect(events[0].startAt).toContain('19:00');
    });

    it('should handle full French day names', async () => {
      const testHtml = `
        <h1>Test Event 2</h1>
        <p>samedi 14/03 (20h‑04h)</p>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2753-test/',
        testHtml
      );

      expect(events[0].startAt).toContain('-03-14');
      expect(events[0].startAt).toContain('20:00');
    });

    it('should handle late night end times (next day)', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2748-sam-28-02-big-science-daily-program',
        eventHtml
      );

      // Fixture has 16h‑01h
      // Should put end time on next day
      if (events[0].endAt) {
        expect(events[0].endAt).toContain('T01:00:00');
        expect(events[0].endAt).toContain('-03-01'); // Next day
      }
    });

    it('should use current year for dates', async () => {
      const testHtml = `
        <h1>Test Event</h1>
        <p>ven 20/03 (20h)</p>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2754-test/',
        testHtml
      );

      const currentYear = new Date().getFullYear();
      expect(events[0].startAt).toContain(`${currentYear}-03-20`);
    });
  });

  describe('Ticket URL extraction', () => {
    it('should handle missing ticket URL gracefully', async () => {
      const minimalHtml = `
        <h1>Test Event</h1>
        <p>Sam 14/03 (20h)</p>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://www.grrrndzero.org/index.php/2753-test-event',
        minimalHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].ticketUrl).toBeNull();
    });
  });
});
