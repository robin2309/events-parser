import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Le Petit Salon adapter for https://www.lpslyon.fr
 * Events link to yp.events (Yurplan) which provides JSON-LD Event schema
 */
export class LePetitSalonAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'lePetitSalon',
    baseUrl: 'https://www.lpslyon.fr',
    displayName: 'Le Petit Salon',
    refreshGroup: 1,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching events listing page');

      const response = await ctx.http.get(
        `${this.meta.baseUrl}/evenements-le-petit-salon/`
      );

      if (response.status !== 200) {
        this.log(ctx, 'warn', `Failed to fetch listing: ${response.status}`);
        return [];
      }

      // Extract yp.events URLs from listing
      const linkRegex = /<a[^>]*href="(https?:\/\/yp\.events\/[^"]+)"[^>]*>/g;
      const urls: string[] = [];
      const seen = new Set<string>();
      let match;

      while ((match = linkRegex.exec(response.body)) !== null) {
        const url = match[1];
        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
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
      // yp.events pages contain JSON-LD Event schema
      const jsonLd = this.extractJsonLd(html);

      const title = (jsonLd?.name as string) || this.extractFallbackTitle(html);
      if (!title || title === 'Untitled Event') {
        this.log(ctx, 'warn', `No title found for ${eventUrl}`);
      }

      const startDate = jsonLd?.startDate as string | undefined;
      const endDate = jsonLd?.endDate as string | undefined;
      const startAt = startDate || new Date().toISOString();
      const endAt = endDate || null;

      const description = (jsonLd?.description as string) || null;
      const imageUrl = this.extractImageFromJsonLd(jsonLd) || this.extractOgImage(html);

      // Extract location from JSON-LD
      const location = jsonLd?.location as Record<string, unknown> | undefined;
      const locationName = (location?.name as string) || 'Le Petit Salon';
      const locationAddress = this.extractAddress(location);

      // The yp.events URL is itself the ticket URL
      const ticketUrl = eventUrl;

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      const event: NormalizedEvent = {
        sourceId: this.meta.adapterName,
        sourceEventId: null,
        eventUrl,
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
        if (data['@type'] === 'Event') return data;
        if (Array.isArray(data)) {
          const event = data.find(
            (item: Record<string, unknown>) => item['@type'] === 'Event'
          );
          if (event) return event as Record<string, unknown>;
        }
      } catch {
        // skip malformed
      }
    }
    return null;
  }

  private extractFallbackTitle(html: string): string {
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (ogTitle) return ogTitle[1].trim();
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return h1Match[1].trim();
    return 'Untitled Event';
  }

  private extractImageFromJsonLd(jsonLd: Record<string, unknown> | null): string | null {
    if (!jsonLd) return null;
    const image = jsonLd.image;
    if (typeof image === 'string') return image;
    if (Array.isArray(image) && image.length > 0) {
      const first = image[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first !== null && 'url' in first) {
        return (first as Record<string, unknown>).url as string;
      }
    }
    return null;
  }

  private extractOgImage(html: string): string | null {
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    return match ? match[1] : null;
  }

  private extractAddress(location: Record<string, unknown> | undefined): string | null {
    if (!location?.address || typeof location.address !== 'object') return null;
    const addr = location.address as Record<string, string>;
    const parts = [addr.streetAddress, addr.postalCode, addr.addressLocality]
      .filter(Boolean)
      .join(', ');
    return parts || null;
  }
}
