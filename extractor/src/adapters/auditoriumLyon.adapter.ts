import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Auditorium de Lyon adapter for https://www.auditorium-lyon.com
 * Drupal-based site with JSON-LD Event data on detail pages
 */
export class AuditoriumLyonAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'auditoriumLyon',
    baseUrl: 'https://www.auditorium-lyon.com',
    displayName: 'Auditorium de Lyon',
    refreshGroup: 1,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching programmation listing page');

      const response = await ctx.http.get(
        `${this.meta.baseUrl}/fr/programmation?type=All&saison=448`
      );

      if (response.status !== 200) {
        this.log(ctx, 'warn', `Failed to fetch programmation: ${response.status}`);
        return [];
      }

      // Event links follow pattern: /fr/saison-YYYY-YY/category/slug
      const linkRegex = /<a\s+href="(\/fr\/saison-[^"]+)"[^>]*>/g;
      const urls: string[] = [];
      const seen = new Set<string>();
      let match;

      while ((match = linkRegex.exec(response.body)) !== null) {
        const normalized = this.normalizeUrl(match[1]);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          urls.push(normalized);
        }
      }

      this.log(ctx, 'info', `Discovered ${urls.length} events`);
      return urls;
    } catch (error) {
      this.log(ctx, 'error', `Discovery failed: ${String(error)}`);
      return [];
    }
  }

  async extract(
    ctx: AdapterContext,
    eventUrl: string,
    html: string
  ): Promise<NormalizedEvent[]> {
    try {
      // Priority 1: JSON-LD Event schema
      const jsonLd = this.extractJsonLd(html);

      const title = jsonLd?.name as string || this.extractTitle(html);
      if (!title || title === 'Untitled Event') {
        this.log(ctx, 'warn', `No title found for ${eventUrl}`);
      }

      const startAt = (jsonLd?.startDate as string) || this.extractDateFromHtml(html);
      if (!startAt) {
        this.log(ctx, 'warn', `No date found for ${eventUrl}`);
        return [];
      }

      const endAt = (jsonLd?.endDate as string) || null;

      // Image: JSON-LD image can be a string or { url: "..." } object
      let imageUrl: string | null = null;
      if (jsonLd?.image) {
        const img = jsonLd.image;
        if (typeof img === 'string') {
          imageUrl = img;
        } else if (typeof img === 'object' && (img as Record<string, unknown>).url) {
          imageUrl = (img as Record<string, unknown>).url as string;
        }
      }
      if (!imageUrl) {
        imageUrl = this.extractMetaContent(html, 'og:image');
      }
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `${this.meta.baseUrl}${imageUrl}`;
      }

      const rawDescription = (jsonLd?.description as string)
        || this.extractMetaContent(html, 'og:description')
        || this.extractMetaContent(html, 'description');
      const description = rawDescription ? this.stripHtml(rawDescription) : null;

      // Extract location from JSON-LD or use defaults
      const location = jsonLd?.location as Record<string, unknown> | undefined;
      const locationName = (location?.name as string) || 'Auditorium de Lyon';
      let locationAddress: string | null = null;
      if (location?.address && typeof location.address === 'object') {
        const addr = location.address as Record<string, string>;
        locationAddress = [addr.streetAddress, addr.postalCode, addr.addressLocality]
          .filter(Boolean)
          .join(', ') || null;
      }

      const ticketUrl = this.extractTicketUrl(html);

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      const urlMatch = eventUrl.match(/\/([^/]+)$/);
      const sourceEventId = urlMatch ? urlMatch[1] : null;

      const event: NormalizedEvent = {
        sourceId: this.meta.adapterName,
        sourceEventId,
        eventUrl: this.normalizeUrl(eventUrl),
        title,
        description,
        startAt,
        endAt,
        timezone: 'Europe/Paris',
        imageUrl,
        locationName,
        locationAddress,
        ticketUrl,
        status: 'active',
        fetchedAt: isoNow,
        lastSeenAt: isoNow,
        contentHash: generateContentHash({ title, startAt, imageUrl }),
      };

      return [event];
    } catch (error) {
      this.log(ctx, 'error', `Extraction failed for ${eventUrl}: ${String(error)}`);
      return [];
    }
  }

  private extractJsonLd(html: string): Record<string, unknown> | null {
    const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        if (data['@type'] === 'Event' || data['@type'] === 'MusicEvent') {
          return data;
        }
        // Handle @graph wrapper: { "@graph": [{ "@type": "Event", ... }] }
        if (Array.isArray(data['@graph'])) {
          const event = data['@graph'].find(
            (item: Record<string, unknown>) =>
              item['@type'] === 'Event' || item['@type'] === 'MusicEvent'
          );
          if (event) return event as Record<string, unknown>;
        }
        if (Array.isArray(data)) {
          const event = data.find(
            (item: Record<string, unknown>) =>
              item['@type'] === 'Event' || item['@type'] === 'MusicEvent'
          );
          if (event) return event as Record<string, unknown>;
        }
      } catch {
        // skip malformed JSON-LD
      }
    }
    return null;
  }

  private extractTitle(html: string): string {
    const ogTitle = this.extractMetaContent(html, 'og:title');
    if (ogTitle) {
      return ogTitle.split('|')[0].trim();
    }
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return h1Match[1].trim();
    return 'Untitled Event';
  }

  private extractDateFromHtml(html: string): string | null {
    const isoMatch = html.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (isoMatch) return isoMatch[1];
    return null;
  }

  private extractMetaContent(html: string, property: string): string | null {
    const regex = new RegExp(
      `<meta\\s+(?:property|name)="${property}"\\s+content="([^"]+)"`,
      'i'
    );
    const match = html.match(regex);
    if (match) return match[1];
    // Try reversed attribute order
    const regex2 = new RegExp(
      `<meta\\s+content="([^"]+)"\\s+(?:property|name)="${property}"`,
      'i'
    );
    const match2 = html.match(regex2);
    return match2 ? match2[1] : null;
  }

  private stripHtml(text: string): string | null {
    const stripped = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.length > 0 ? stripped : null;
  }

  private extractTicketUrl(html: string): string | null {
    const domains = ['billetterie.auditorium-lyon.com', 'ticketmaster', 'eventbrite', 'weezevent'];
    for (const domain of domains) {
      const match = html.match(new RegExp(`<a[^>]*href="([^"]*${domain}[^"]*)"`, 'i'));
      if (match) return match[1];
    }
    const textMatch = html.match(
      /<a[^>]*href="([^"]+)"[^>]*>[^<]*(?:réserver|billetterie|tickets?)[^<]*<\/a>/i
    );
    return textMatch ? textMatch[1] : null;
  }
}
