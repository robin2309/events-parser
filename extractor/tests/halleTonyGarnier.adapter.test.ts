import { describe, it, expect, beforeAll } from 'vitest';
import { HalleTonyGarnierAdapter } from '../src/adapters/halleTonyGarnier.adapter.js';
import type { AdapterContext, Logger } from '../src/types/source.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('HalleTonyGarnier Adapter', () => {
  let adapter: HalleTonyGarnierAdapter;
  let mockLogger: Logger;
  let mockContext: AdapterContext;
  let listingHtml: string;
  let eventHtml: string;

  beforeAll(() => {
    adapter = new HalleTonyGarnierAdapter();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const fixturesDir = join(__dirname, '..', 'fixtures', 'halleTonyGarnier');
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
      expect(adapter.meta.adapterName).toBe('halleTonyGarnier');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.halle-tony-garnier.com');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Halle Tony Garnier');
    });
  });

  describe('Discovery', () => {
    it('should discover event URLs from listing page', async () => {
      const urls = await adapter.discover(mockContext);
      expect(urls.length).toBeGreaterThan(0);
      urls.forEach((url) => {
        expect(url).toContain('halle-tony-garnier.com/fr/programmation/');
      });
    });

    it('should return fully qualified URLs', async () => {
      const urls = await adapter.discover(mockContext);
      urls.forEach((url) => {
        expect(url.startsWith('https://')).toBe(true);
      });
    });

    it('should dedup events with same title on the same day', async () => {
      // Fixture has two HOLIDAY ON ICE "HORIZONS" entries on 28.02.26
      // (14h00 and 17h30) plus one on 01.03.26 — should keep one per day
      const urls = await adapter.discover(mockContext);

      const holidayUrls = urls.filter((u) => u.includes('holiday-on-ice'));
      // 2 unique days (28.02.26 and 01.03.26), not 3 entries
      expect(holidayUrls.length).toBe(2);
    });

    it('should keep events with same title on different days', async () => {
      const urls = await adapter.discover(mockContext);

      const holidayUrls = urls.filter((u) => u.includes('holiday-on-ice'));
      // One for 28.02.26 and one for 01.03.26
      expect(holidayUrls.length).toBe(2);
    });
  });

  describe('Extraction', () => {
    it('should extract event with all required fields', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events.length).toBe(1);
      const event = events[0];

      expect(event.sourceId).toBe('halleTonyGarnier');
      expect(event.title).toBe('HOLIDAY ON ICE "HORIZONS"');
      expect(event.timezone).toBe('Europe/Paris');
      expect(event.fetchedAt).toBeDefined();
      expect(event.contentHash).toBeDefined();
    });

    it('should decode HTML entities in title', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/holiday-on-ice',
        eventHtml
      );

      expect(events[0].title).toBe('HOLIDAY ON ICE "HORIZONS"');
      expect(events[0].title).not.toContain('&quot;');
    });

    it('should decode HTML entities in description', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/holiday-on-ice',
        eventHtml
      );

      expect(events[0].description).toContain('"Horizons"');
      expect(events[0].description).not.toContain('&quot;');
      expect(events[0].description).not.toContain('&#39;');
    });

    it('should parse DD.MM.YY date format', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events[0].startAt).toContain('2026-03-24');
    });

    it('should parse HHhMM time format', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      // First time match is 18h30 (door time)
      expect(events[0].startAt).toContain('18:30');
    });

    it('should extract image URL from og:image', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events[0].imageUrl).toContain('halle-tony-garnier.com');
    });

    it('should extract ticket URL', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events[0].ticketUrl).toContain('tickandlive.com');
    });

    it('should set location info', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events[0].locationName).toBe('Halle Tony Garnier');
      expect(events[0].locationAddress).toContain('Lyon');
    });

    it('should extract source event ID from URL slug', async () => {
      const events = await adapter.extract(
        mockContext,
        'https://www.halle-tony-garnier.com/fr/programmation/lara-fabian-2',
        eventHtml
      );

      expect(events[0].sourceEventId).toBe('lara-fabian-2');
    });
  });
});
