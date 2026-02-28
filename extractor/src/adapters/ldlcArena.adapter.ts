import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * LDLC Arena adapter for https://www.olvallee.fr
 * WordPress site with event cards linking to /evenement/ detail pages
 */
export class LdlcArenaAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'ldlcArena',
    baseUrl: 'https://www.olvallee.fr',
    displayName: 'LDLC Arena',
    refreshGroup: 1,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching arena calendar listing');

      const urls: string[] = [];
      const seen = new Set<string>();

      // Fetch up to 3 pages
      for (let page = 1; page <= 3; page++) {
        const pageUrl = page === 1
          ? `${this.meta.baseUrl}/calendrier/?univers=arena`
          : `${this.meta.baseUrl}/calendrier/page/${page}/?univers=arena`;

        const response = await ctx.http.get(pageUrl);
        if (response.status !== 200) break;

        // Extract event links: /evenement/slug/
        const linkRegex = /<a[^>]*href="([^"]*\/evenement\/[^"]+)"[^>]*>/g;
        let match;

        while ((match = linkRegex.exec(response.body)) !== null) {
          const url = match[1];
          const normalized = this.normalizeUrl(url);
          if (!seen.has(normalized)) {
            seen.add(normalized);
            urls.push(normalized);
          }
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
      const title = this.extractTitle(html);
      const { startAt, endAt } = this.extractDateTime(html);
      const description = this.extractDescription(html);
      const imageUrl = this.extractImageUrl(html);
      const ticketUrl = this.extractTicketUrl(html);

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      const urlMatch = eventUrl.match(/\/evenement\/([^/]+)/);
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
        locationName: 'LDLC Arena',
        locationAddress: 'Lyon-Décines, France',
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

  private extractTitle(html: string): string {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return h1Match[1].trim();
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (ogTitle) {
      return ogTitle[1].replace(/\s*\|\s*Billetterie.*$/i, '').trim();
    }
    return 'Untitled Event';
  }

  private extractDateTime(html: string): { startAt: string; endAt: string | null } {
    // Pattern: "28 février 2026 - 20:00"
    const dateTimeMatch = html.match(
      /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})\s*[-–]\s*(\d{1,2})[h:](\d{2})/i
    );

    if (dateTimeMatch) {
      const day = parseInt(dateTimeMatch[1], 10);
      const monthNum = this.frenchMonthToNumber(dateTimeMatch[2]);
      const year = parseInt(dateTimeMatch[3], 10);
      const hours = parseInt(dateTimeMatch[4], 10);
      const minutes = parseInt(dateTimeMatch[5], 10);

      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const startAt = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+02:00`;
      return { startAt, endAt: null };
    }

    // Fallback: try any date pattern "DD month YYYY"
    const dateOnly = html.match(
      /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i
    );
    if (dateOnly) {
      const day = parseInt(dateOnly[1], 10);
      const monthNum = this.frenchMonthToNumber(dateOnly[2]);
      const year = parseInt(dateOnly[3], 10);
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { startAt: `${dateStr}T20:00:00+02:00`, endAt: null };
    }

    return { startAt: new Date().toISOString(), endAt: null };
  }

  private frenchMonthToNumber(month: string): number {
    const months: Record<string, number> = {
      janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
    };
    return months[month.toLowerCase()] || 1;
  }

  private extractDescription(html: string): string | null {
    const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);
    if (ogMatch) return ogMatch[1].trim();
    return null;
  }

  private extractImageUrl(html: string): string | null {
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (ogMatch) return ogMatch[1];
    return null;
  }

  private extractTicketUrl(html: string): string | null {
    const domains = ['billetterie.ol.fr', 'ticketmaster', 'eventbrite', 'weezevent', 'digitick'];
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
