import { describe, it, expect, beforeAll } from 'vitest';
import { LePetitSalonAdapter } from '../src/adapters/lePetitSalon.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('LePetitSalon Adapter', () => {
  let adapter: LePetitSalonAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let listingHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new LePetitSalonAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const fixturesDir = join(__dirname, '..', 'fixtures', 'lePetitSalon');
    listingHtml = readFileSync(join(fixturesDir, 'listing.html'), 'utf-8');
    eventHtml = readFileSync(join(fixturesDir, 'event.html'), 'utf-8');

    mockContext = {
      logger: mockLogger,
      http: {
        get: async (url: string) => {
          if (url.includes('/evenements-le-petit-salon/')) {
            return { status: 200, statusText: 'OK', body: listingHtml, headers: {} };
          }
          return { status: 404, statusText: 'Not Found', body: '', headers: {} };
        },
      },
      now: () => new Date('2026-02-28T00:00:00Z'),
    };
  });

  describe('Metadata', () => {
    it('should have correct adapter name', () => {
      expect(adapter.meta.adapterName).toBe('lePetitSalon');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.lpslyon.fr');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Le Petit Salon');
    });
  });

  describe('Discovery', () => {
    it('should discover yp.events URLs from listing page', async () => {
      const urls = await adapter.discover(mockContext);
      expect(urls.length).toBe(3);
      urls.forEach((url) => {
        expect(url).toContain('yp.events/');
      });
    });

    it('should deduplicate URLs', async () => {
      const urls = await adapter.discover(mockContext);
      const unique = new Set(urls);
      expect(urls.length).toBe(unique.size);
    });
  });

  describe('Extraction', () => {
    it('should extract event from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5',
        eventHtml
      );

      expect(events.length).toBe(1);
      const event = events[0];

      expect(event.sourceId).toBe('lePetitSalon');
      expect(event.title).toContain('THIS IS TECHNO');
      expect(event.timezone).toBe('Europe/Paris');
      expect(event.fetchedAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should extract start and end dates from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5',
        eventHtml
      );

      expect(events[0].startAt).toContain('2026-02-27T22:30');
      expect(events[0].endAt).toContain('2026-02-28T05:30');
    });

    it('should extract image from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5',
        eventHtml
      );

      expect(events[0].imageUrl).toContain('imagedelivery.net');
    });

    it('should extract location from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5',
        eventHtml
      );

      expect(events[0].locationName).toBe('Le Petit Salon');
      expect(events[0].locationAddress).toContain('Cronstadt');
    });

    it('should use event URL as ticket URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5',
        eventHtml
      );

      expect(events[0].ticketUrl).toBe('https://yp.events/daf5b55e-b77a-486e-9654-1a45833a7df5');
    });

    it('should handle HTML without JSON-LD', async () => {
      const minimalHtml = `
        <html><head>
          <meta property="og:title" content="Test Event" />
        </head><body>
          <h1>Test Event</h1>
        </body></html>
      `;

      const events = await adapter.extract(
        mockContext,
        'https://yp.events/test-id',
        minimalHtml
      );

      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Test Event');
    });
  });
});
