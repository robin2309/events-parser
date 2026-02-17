import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Le Transbordeur venue adapter for https://www.transbordeur.fr
 * Lyon-based concert and event venue
 *
 * Uses the WordPress REST API at /wp-json/wp/v2/evenement
 * which exposes structured event data including ACF custom fields
 * for dates, times, ticket links, and images.
 */
export class LeTransbordeurAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'leTransbordeur',
    baseUrl: 'https://www.transbordeur.fr',
    displayName: 'Le Transbordeur',
    refreshGroup: 1,
  };

  /**
   * Discover event URLs via the WP REST API.
   * Returns individual API endpoint URLs so extract() receives JSON.
   */
  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching events from WP REST API');

      const response = await ctx.http.get(
        `${this.meta.baseUrl}/wp-json/wp/v2/evenement?per_page=100`
      );

      if (response.status !== 200) {
        this.log(ctx, 'warn', `API returned ${response.status}`);
        return [];
      }

      const events = JSON.parse(response.body);

      if (!Array.isArray(events)) {
        this.log(ctx, 'warn', 'API response is not an array');
        return [];
      }

      const urls = events.map(
        (e: { id: number }) => `${this.meta.baseUrl}/wp-json/wp/v2/evenement/${e.id}`
      );

      this.log(ctx, 'info', `Discovered ${urls.length} events`);
      return urls;
    } catch (error) {
      this.log(ctx, 'error', `Discovery failed: ${String(error)}`);
      return [];
    }
  }

  /**
   * Extract normalized event from the API JSON response.
   * The runner fetches each individual API URL and passes the JSON body here.
   */
  async extract(
    ctx: AdapterContext,
    eventUrl: string,
    body: string
  ): Promise<NormalizedEvent[]> {
    try {
      const data = JSON.parse(body);
      const acf = data.acf || {};

      const title = data.title?.rendered || 'Untitled Event';
      const { startAt, endAt } = this.buildDateTimes(acf.date, acf.hour_begin, acf.hour_end);
      const description = this.extractDescription(acf);
      const ticketUrl = acf.bouton_booking?.url || null;
      const canonicalUrl = data.link || eventUrl;

      // Resolve image URL from media ID
      let imageUrl: string | null = null;
      if (typeof acf.image_preview === 'number' && acf.image_preview > 0) {
        imageUrl = await this.resolveMediaUrl(ctx, acf.image_preview);
      }

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      const event: NormalizedEvent = {
        sourceId: this.meta.adapterName,
        sourceEventId: String(data.id),
        eventUrl: canonicalUrl,
        title,
        description,
        startAt,
        endAt,
        timezone: 'Europe/Paris',
        imageUrl,
        locationName: 'Le Transbordeur',
        locationAddress: 'Lyon, France',
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

  /**
   * Build ISO 8601 datetime strings from ACF date/time fields.
   * ACF date format: "20260305" (YYYYMMDD)
   * ACF time format: "19:00:00"
   */
  private buildDateTimes(
    dateStr?: string,
    startTime?: string,
    endTime?: string
  ): { startAt: string; endAt: string | null } {
    if (!dateStr || dateStr.length !== 8) {
      return { startAt: new Date().toISOString(), endAt: null };
    }

    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const start = startTime || '20:00:00';

    const startAt = `${year}-${month}-${day}T${start}+01:00`;

    let endAt: string | null = null;
    if (endTime) {
      const startHour = parseInt(start.split(':')[0], 10);
      const endHour = parseInt(endTime.split(':')[0], 10);

      if (endHour < startHour) {
        // End time is next day (e.g., starts 23:30, ends 06:00)
        const nextDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) + 1);
        const nd = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        endAt = `${nd}T${endTime}+01:00`;
      } else {
        endAt = `${year}-${month}-${day}T${endTime}+01:00`;
      }
    }

    return { startAt, endAt };
  }

  /**
   * Extract description from ACF content blocks or text_desc field.
   */
  private extractDescription(acf: Record<string, unknown>): string | null {
    // Try structured content blocks first
    if (Array.isArray(acf.content)) {
      const descriptions = acf.content
        .filter((block: { description?: string }) => block.description)
        .map((block: { description: string }) => block.description);

      if (descriptions.length > 0) {
        return descriptions.join('\n\n');
      }
    }

    // Fallback to text_desc
    if (typeof acf.text_desc === 'string' && acf.text_desc.trim()) {
      return acf.text_desc.trim();
    }

    return null;
  }

  /**
   * Resolve a WordPress media ID to its source URL.
   */
  private async resolveMediaUrl(ctx: AdapterContext, mediaId: number): Promise<string | null> {
    try {
      const res = await ctx.http.get(
        `${this.meta.baseUrl}/wp-json/wp/v2/media/${mediaId}?_fields=source_url`
      );

      if (res.status === 200) {
        const media = JSON.parse(res.body);
        return media.source_url || null;
      }
    } catch {
      // Non-critical — just skip the image
    }
    return null;
  }
}
