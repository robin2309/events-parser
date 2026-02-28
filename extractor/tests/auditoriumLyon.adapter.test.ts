import { describe, it, expect, beforeAll } from 'vitest';
import { AuditoriumLyonAdapter } from '../src/adapters/auditoriumLyon.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('AuditoriumLyon Adapter', () => {
  let adapter: AuditoriumLyonAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let listingHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new AuditoriumLyonAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const fixturesDir = join(__dirname, '..', 'fixtures', 'auditoriumLyon');
    listingHtml = readFileSync(join(fixturesDir, 'listing.html'), 'utf-8');
    eventHtml = readFileSync(join(fixturesDir, 'event.html'), 'utf-8');

    mockContext = {
      logger: mockLogger,
      http: {
        get: async (url: string) => {
          if (url.includes('/programmation')) {
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
      expect(adapter.meta.adapterName).toBe('auditoriumLyon');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.auditorium-lyon.com');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Auditorium de Lyon');
    });
  });

  describe('Discovery', () => {
    it('should discover event URLs from listing page', async () => {
      const urls = await adapter.discover(mockContext);
      expect(urls.length).toBeGreaterThan(0);
      urls.forEach((url) => {
        expect(url).toContain('auditorium-lyon.com/fr/saison-');
      });
    });

    it('should return fully qualified URLs', async () => {
      const urls = await adapter.discover(mockContext);
      urls.forEach((url) => {
        expect(url.startsWith('https://')).toBe(true);
      });
    });

    it('should deduplicate URLs', async () => {
      const urls = await adapter.discover(mockContext);
      const unique = new Set(urls);
      expect(urls.length).toBe(unique.size);
    });
  });

  describe('Extraction', () => {
    it('should extract event with all required fields from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events.length).toBe(1);
      const event = events[0];

      expect(event.sourceId).toBe('auditoriumLyon');
      expect(event.title).toBe('Mahler / Brahms');
      expect(event.startAt).toBe('2026-02-27T20:00');
      expect(event.endAt).toBe('2026-02-28');
      expect(event.timezone).toBe('Europe/Paris');
      expect(event.fetchedAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should extract location from JSON-LD', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events[0].locationName).toBe('Auditorium - Orchestre national de Lyon');
      expect(events[0].locationAddress).toContain('149 Rue Garibaldi');
    });

    it('should extract ticket URL from JSON-LD offers', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events[0].ticketUrl).toContain('billetterie.auditorium-lyon.com');
    });

    it('should extract image URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events[0].imageUrl).toContain('Trifonov');
    });

    it('should extract description', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events[0].description).toContain('Symphonique');
    });

    it('should extract source event ID from URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.auditorium-lyon.com/fr/saison-2025-26/symphonique/mahler-brahms',
        eventHtml
      );

      expect(events[0].sourceEventId).toBe('mahler-brahms');
    });

    it('should handle HTML without JSON-LD gracefully', async () => {
      const minimalHtml = `
        <html><head>
          <meta property="og:title" content="Test Concert" />
        </head><body>
          <h1>Test Concert</h1>
          <time>2026-03-15T20:00</time>
        </body></html>
      `;

      const events = await adapter.extract(mockContext, 'https://www.auditorium-lyon.com/fr/test', minimalHtml);
      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Test Concert');
    });
  });
});
