import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Halle Tony Garnier adapter for https://www.halle-tony-garnier.com
 * Events listed with DD.MM.YY date format and HHhMM time format
 */
export class HalleTonyGarnierAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'halleTonyGarnier',
    baseUrl: 'https://www.halle-tony-garnier.com',
    displayName: 'Halle Tony Garnier',
    refreshGroup: 1,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching programmation listing page');

      const response = await ctx.http.get(`${this.meta.baseUrl}/fr/programmation`);

      if (response.status !== 200) {
        this.log(ctx, 'warn', `Failed to fetch programmation: ${response.status}`);
        return [];
      }

      // Event links: /fr/programmation/slug with surrounding text
      const blockRegex = /<a\s+href="([^"]*\/fr\/programmation\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const urls: string[] = [];
      const seenUrls = new Set<string>();
      const seenTitleDates = new Set<string>();
      let match;

      while ((match = blockRegex.exec(response.body)) !== null) {
        const url = match[1];
        const text = this.decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

        // Skip the main programmation page itself
        if (url === '/fr/programmation' || url === '/fr/programmation/') continue;

        const normalized = this.normalizeUrl(url);
        if (seenUrls.has(normalized)) continue;

        // Extract date (DD.MM.YY) and title from the link text to dedup same-day shows
        const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{2})/);
        const date = dateMatch ? dateMatch[1] : '';
        // Title is the text minus the date/time/status parts
        const title = text
          .replace(/\d{2}\.\d{2}\.\d{2}/, '')
          .replace(/\d{1,2}h\d{2}/, '')
          .replace(/\bcomplet\b/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        const dedupKey = `${title}|${date}`;
        if (seenTitleDates.has(dedupKey)) continue;

        seenUrls.add(normalized);
        seenTitleDates.add(dedupKey);
        urls.push(normalized);
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

      const urlMatch = eventUrl.match(/\/programmation\/([^/]+)/);
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
        locationName: 'Halle Tony Garnier',
        locationAddress: '20 Place Docteurs Charles et Christophe Mérieux, 69007 Lyon, France',
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
    // Try og:title first
    const ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (ogMatch) {
      return this.decodeHtmlEntities(ogMatch[1].split('|')[0].trim());
    }
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return this.decodeHtmlEntities(h1Match[1].trim());
    return 'Untitled Event';
  }

  private extractDateTime(html: string): { startAt: string; endAt: string | null } {
    // Date format: DD.MM.YY (e.g., 28.02.26)
    const dateMatch = html.match(/(\d{2})\.(\d{2})\.(\d{2})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);
      year = year < 70 ? 2000 + year : 1900 + year;

      // Time format: HHhMM (e.g., 20h00) or HH:MM
      const timeMatch = html.match(/(\d{1,2})h(\d{2})/);
      const hours = timeMatch ? parseInt(timeMatch[1], 10) : 20;
      const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const startAt = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+02:00`;
      return { startAt, endAt: null };
    }

    // Fallback: ISO date
    const isoMatch = html.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (isoMatch) {
      return { startAt: `${isoMatch[1]}:00+02:00`, endAt: null };
    }

    return { startAt: new Date().toISOString(), endAt: null };
  }

  private extractDescription(html: string): string | null {
    const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/);
    if (ogMatch) return this.decodeHtmlEntities(ogMatch[1].trim());
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    if (metaMatch) return this.decodeHtmlEntities(metaMatch[1].trim());
    return null;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private extractImageUrl(html: string): string | null {
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (ogMatch) {
      const url = ogMatch[1];
      return url.startsWith('http') ? url : `${this.meta.baseUrl}${url}`;
    }
    return null;
  }

  private extractTicketUrl(html: string): string | null {
    const domains = ['tickandlive', 'ticketmaster', 'fnacspectacles', 'eventbrite', 'weezevent'];
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
