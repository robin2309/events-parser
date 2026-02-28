import { describe, it, expect, beforeAll } from 'vitest';
import { LdlcArenaAdapter } from '../src/adapters/ldlcArena.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('LdlcArena Adapter', () => {
  let adapter: LdlcArenaAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let listingHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new LdlcArenaAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const fixturesDir = join(__dirname, '..', 'fixtures', 'ldlcArena');
    listingHtml = readFileSync(join(fixturesDir, 'listing.html'), 'utf-8');
    eventHtml = readFileSync(join(fixturesDir, 'event.html'), 'utf-8');

    mockContext = {
      logger: mockLogger,
      http: {
        get: async (url: string) => {
          if (url.includes('/calendrier/')) {
            return { status: 200, statusText: 'OK', body: listingHtml, headers: {} };
          }
          // Return 404 for page 2+ to stop pagination
          if (url.includes('page/')) {
            return { status: 404, statusText: 'Not Found', body: '', headers: {} };
          }
          return { status: 404, statusText: 'Not Found', body: '', headers: {} };
        },
      },
      now: () => new Date('2026-02-28T00:00:00Z'),
    };
  });

  describe('Metadata', () => {
    it('should have correct adapter name', () => {
      expect(adapter.meta.adapterName).toBe('ldlcArena');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.olvallee.fr');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('LDLC Arena');
    });
  });

  describe('Discovery', () => {
    it('should discover event URLs from listing page', async () => {
      const urls = await adapter.discover(mockContext);
      expect(urls.length).toBe(3);
      urls.forEach((url) => {
        expect(url).toContain('olvallee.fr/evenement/');
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
    it('should extract event with all required fields', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events.length).toBe(1);
      const event = events[0];

      expect(event.sourceId).toBe('ldlcArena');
      expect(event.title).toBe('Messmer à Lyon-Décines');
      expect(event.timezone).toBe('Europe/Paris');
      expect(event.fetchedAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should parse French date format', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].startAt).toContain('2026-02-28');
      expect(events[0].startAt).toContain('20:00');
    });

    it('should extract image URL from og:image', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].imageUrl).toContain('MESSMER');
    });

    it('should extract description from og:description', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].description).toContain('Messmer');
    });

    it('should extract ticket URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].ticketUrl).toContain('billetterie.ol.fr');
    });

    it('should set location info', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].locationName).toBe('LDLC Arena');
      expect(events[0].locationAddress).toContain('Lyon');
    });

    it('should extract source event ID from URL slug', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.olvallee.fr/evenement/messmer-lyon-2026/',
        eventHtml
      );

      expect(events[0].sourceEventId).toBe('messmer-lyon-2026');
    });
  });
});
