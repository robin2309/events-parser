import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LeTransbordeurAdapter } from '../src/adapters/leTransbordeur.adapter.js';
import type { AdapterContext } from '../src/types/source.js';
import type { NormalizedEvent } from '../src/types/event.js';

describe('LeTransbordeur Adapter', () => {
  let adapter: LeTransbordeurAdapter;
  let mockContext: AdapterContext;
  let listingJson: string;
  let eventJson: string;

  beforeEach(() => {
    adapter = new LeTransbordeurAdapter();

    const fixturesDir = path.resolve(process.cwd(), 'fixtures/leTransbordeur');
    listingJson = fs.readFileSync(path.join(fixturesDir, 'listing.json'), 'utf-8');
    eventJson = fs.readFileSync(path.join(fixturesDir, 'event.json'), 'utf-8');

    mockContext = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      http: {
        get: vi.fn(),
      },
      now: () => new Date('2026-02-08T00:00:00Z'),
    };
  });

  describe('Metadata', () => {
    it('should have correct adapter name', () => {
      expect(adapter.meta.adapterName).toBe('leTransbordeur');
    });

    it('should have correct base URL', () => {
      expect(adapter.meta.baseUrl).toBe('https://www.transbordeur.fr');
    });

    it('should have display name', () => {
      expect(adapter.meta.displayName).toBe('Le Transbordeur');
    });

    it('should have refresh group assigned', () => {
      expect(adapter.meta.refreshGroup).toBe(1);
    });
  });

  describe('discover()', () => {
    it('should extract event API URLs from listing', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: listingJson,
      });

      const urls = await adapter.discover(mockContext);

      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://www.transbordeur.fr/wp-json/wp/v2/evenement/34487');
      expect(urls[1]).toBe('https://www.transbordeur.fr/wp-json/wp/v2/evenement/34854');
      expect(urls[2]).toBe('https://www.transbordeur.fr/wp-json/wp/v2/evenement/35005');
    });

    it('should return empty array on HTTP error', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 500,
        body: '',
      });

      const urls = await adapter.discover(mockContext);

      expect(urls).toEqual([]);
      expect(mockContext.logger.warn).toHaveBeenCalled();
    });

    it('should return empty array on invalid JSON', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: 'not json',
      });

      const urls = await adapter.discover(mockContext);

      expect(urls).toEqual([]);
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (mockContext.http.get as any).mockRejectedValueOnce(new Error('Network error'));

      const urls = await adapter.discover(mockContext);

      expect(urls).toEqual([]);
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('extract()', () => {
    it('should extract all required fields', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://www.transbordeur.fr/wp-content/uploads/2025/12/victorien.jpg' }),
      });

      const apiUrl = 'https://www.transbordeur.fr/wp-json/wp/v2/evenement/34487';
      const events = await adapter.extract(mockContext, apiUrl, eventJson);

      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.sourceId).toBe('leTransbordeur');
      expect(event.sourceEventId).toBe('34487');
      expect(event.eventUrl).toBe('https://www.transbordeur.fr/evenement/victorien-05032026/');
      expect(event.title).toBe('VICTORIEN');
      expect(event.startAt).toBe('2026-03-05T19:00:00+01:00');
      expect(event.endAt).toBe('2026-03-05T20:00:00+01:00');
      expect(event.timezone).toBe('Europe/Paris');
      expect(event.locationName).toBe('Le Transbordeur');
      expect(event.status).toBe('active');
      expect(event.fetchedAt).toBeTruthy();
      expect(event.lastSeenAt).toBeTruthy();
      expect(event.contentHash).toBeTruthy();
    });

    it('should extract ticket URL from bouton_booking', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://example.com/img.jpg' }),
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);

      expect(events[0].ticketUrl).toContain('digitick.com');
    });

    it('should extract description from ACF content blocks', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://example.com/img.jpg' }),
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);

      expect(events[0].description).toContain('Victorien');
    });

    it('should resolve image URL from media API', async () => {
      const imageUrl = 'https://www.transbordeur.fr/wp-content/uploads/2025/12/victorien.jpg';
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: imageUrl }),
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);

      expect(events[0].imageUrl).toBe(imageUrl);
      expect(mockContext.http.get).toHaveBeenCalledWith(
        'https://www.transbordeur.fr/wp-json/wp/v2/media/34490?_fields=source_url'
      );
    });

    it('should handle missing image gracefully', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 404,
        body: '',
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);

      expect(events[0].imageUrl).toBeNull();
    });

    it('should handle late-night end times (next day)', async () => {
      const lateNightEvent = JSON.stringify({
        id: 34854,
        title: { rendered: 'CARV' },
        link: 'https://www.transbordeur.fr/evenement/carv-07032026/',
        acf: {
          date: '20260307',
          hour_begin: '23:30:00',
          hour_end: '06:00:00',
          bouton_booking: null,
          image_preview: 0,
        },
      });

      const events = await adapter.extract(mockContext, 'url', lateNightEvent);

      expect(events[0].startAt).toBe('2026-03-07T23:30:00+01:00');
      expect(events[0].endAt).toBe('2026-03-08T06:00:00+01:00');
    });

    it('should handle missing ACF date gracefully', async () => {
      const noDateEvent = JSON.stringify({
        id: 99999,
        title: { rendered: 'NO DATE EVENT' },
        link: 'https://www.transbordeur.fr/evenement/test/',
        acf: {},
      });

      const events = await adapter.extract(mockContext, 'url', noDateEvent);

      expect(events).toHaveLength(1);
      expect(events[0].startAt).toBeTruthy();
    });

    it('should handle invalid JSON body gracefully', async () => {
      const events = await adapter.extract(mockContext, 'url', 'not json');

      expect(events).toEqual([]);
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should set ticketUrl to null when no booking info', async () => {
      const noBookingEvent = JSON.stringify({
        id: 11111,
        title: { rendered: 'FREE EVENT' },
        link: 'https://www.transbordeur.fr/evenement/free/',
        acf: {
          date: '20260401',
          hour_begin: '20:00:00',
          bouton_booking: null,
          image_preview: 0,
        },
      });

      const events = await adapter.extract(mockContext, 'url', noBookingEvent);

      expect(events[0].ticketUrl).toBeNull();
    });

    it('should fall back to text_desc when no content blocks', async () => {
      const textDescEvent = JSON.stringify({
        id: 22222,
        title: { rendered: 'TEXT DESC EVENT' },
        link: 'https://www.transbordeur.fr/evenement/text-desc/',
        acf: {
          date: '20260401',
          hour_begin: '20:00:00',
          bouton_booking: null,
          image_preview: 0,
          text_desc: 'A great event description.',
          content: [],
        },
      });

      const events = await adapter.extract(mockContext, 'url', textDescEvent);

      expect(events[0].description).toBe('A great event description.');
    });
  });

  describe('Event shape validation', () => {
    it('should return properly shaped NormalizedEvent objects', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://example.com/img.jpg' }),
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);
      const event = events[0] as NormalizedEvent;

      expect(typeof event.sourceId).toBe('string');
      expect(typeof event.eventUrl).toBe('string');
      expect(typeof event.title).toBe('string');
      expect(typeof event.startAt).toBe('string');
      expect(typeof event.timezone).toBe('string');
      expect(typeof event.fetchedAt).toBe('string');
      expect(typeof event.lastSeenAt).toBe('string');
      expect(typeof event.contentHash).toBe('string');
    });

    it('should format startAt in ISO 8601 with timezone', async () => {
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://example.com/img.jpg' }),
      });

      const events = await adapter.extract(mockContext, 'url', eventJson);

      expect(events[0].startAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should process a complete discover + extract workflow', async () => {
      // Mock listing API call
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: listingJson,
      });

      const urls = await adapter.discover(mockContext);
      expect(urls).toHaveLength(3);

      // Mock media API call for image resolution
      (mockContext.http.get as any).mockResolvedValueOnce({
        status: 200,
        body: JSON.stringify({ source_url: 'https://example.com/img.jpg' }),
      });

      const events = await adapter.extract(mockContext, urls[0], eventJson);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('VICTORIEN');
      expect(events[0].ticketUrl).toContain('digitick.com');
    });
  });
});
