import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Le Sucre venue adapter for https://le-sucre.eu
 * Lyon-based music/event venue with club nights and concerts
 */
export class LeSucreAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'leSucre',
    baseUrl: 'https://le-sucre.eu',
    displayName: 'Le Sucre',
    refreshGroup: 1,
  };

  /**
   * Discover event URLs from the agenda listing page
   */
  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching agenda listing page');

      const response = await ctx.http.get(`${this.meta.baseUrl}/agenda/`);

      if (response.status !== 200) {
        this.log(ctx, 'warn', `Failed to fetch agenda: ${response.status}`);
        return [];
      }

      // Extract all event URLs from listing page
      // Events are in <a class="event" href="..."> tags
      const eventRegex = /<a\s+class="event"[^>]*href="([^"]+)"/g;
      const urls: string[] = [];
      let match;

      while ((match = eventRegex.exec(response.body)) !== null) {
        const url = match[1];
        // Skip the archives link
        if (!url.includes('/agenda-archives/')) {
          urls.push(this.normalizeUrl(url));
        }
      }

      this.log(ctx, 'info', `Discovered ${urls.length} events`);
      return urls;
    } catch (error) {
      this.log(ctx, 'error', `Discovery failed: ${String(error)}`);
      return [];
    }
  }

  /**
   * Extract normalized event from detail page
   */
  async extract(
    ctx: AdapterContext,
    eventUrl: string,
    html: string
  ): Promise<NormalizedEvent[]> {
    try {
      const title = this.extractTitle(html);
      const { day, month, year, hours } = this.extractDate(html);
      const { startAt, endAt } = this.buildDateTimes(day, month, year, hours);
      const description = this.extractDescription(html);
      const imageUrl = this.extractImageUrl(html);
      const ticketUrl = this.extractTicketUrl(html);

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      // Extract source event ID from URL slug
      const urlMatch = eventUrl.match(/\/events\/([^/]+)\//);
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
        locationName: 'Le Sucre',
        locationAddress: 'Lyon, France',
        ticketUrl,
        status: 'active',
        fetchedAt: isoNow,
        lastSeenAt: isoNow,
        contentHash: generateContentHash({
          title,
          startAt,
          imageUrl,
        }),
      };

      return [event];
    } catch (error) {
      this.log(ctx, 'error', `Extraction failed for ${eventUrl}: ${String(error)}`);
      return [];
    }
  }

  /**
   * Extract event title from the detail page
   */
  private extractTitle(html: string): string {
    // Title is in <h1> within section#section-header
    const h1Match = html.match(/<section\s+id="section-header">[\s\S]*?<h1>([^<]+)<\/h1>/);
    if (h1Match) {
      return h1Match[1].trim();
    }
    return 'Untitled Event';
  }

  /**
   * Extract date and time information from the detail page
   * Format: dimanche 8 février, 18:00 — 00:00
   */
  private extractDate(html: string): {
    day: number;
    month: string;
    year: number;
    hours: string;
  } {
    // Extract day number: <div class="day">8</div>
    const dayMatch = html.match(/<div\s+class="day">(\d+)<\/div>/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;

    // Extract month: <div class="month">février</div>
    const monthMatch = html.match(/<div\s+class="month">([^<]+)<\/div>/);
    const month = monthMatch ? monthMatch[1].trim() : 'janvier';

    // Extract hours: <div class="hours">18:00&nbsp;—&nbsp;00:00</div>
    const hoursMatch = html.match(/<div\s+class="hours">([^<]+)<\/div>/);
    const hours = hoursMatch ? hoursMatch[1].trim() : '20:00 — 03:00';

    // Use current year (or future if date seems to be in future)
    const year = new Date().getFullYear();

    return { day, month, year, hours };
  }

  /**
   * Convert French month name to number
   */
  private frenchMonthToNumber(month: string): number {
    const months: { [key: string]: number } = {
      janvier: 1,
      février: 2,
      mars: 3,
      avril: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      août: 8,
      septembre: 9,
      octobre: 10,
      novembre: 11,
      décembre: 12,
    };
    return months[month.toLowerCase()] || 1;
  }

  /**
   * Build ISO 8601 datetime strings from extracted date/time info
   */
  private buildDateTimes(
    day: number,
    month: string,
    year: number,
    hoursStr: string
  ): { startAt: string; endAt: string | null } {
    const monthNum = this.frenchMonthToNumber(month);

    // Parse hours string: "18:00 — 00:00" or "18:00&nbsp;—&nbsp;00:00"
    const cleanHours = hoursStr.replace(/&nbsp;/g, ' ').trim();
    const timeParts = cleanHours.split(/\s+[—-]\s+/);

    let startTime = '20:00';
    let endTime: string | null = null;

    if (timeParts.length >= 1) {
      startTime = timeParts[0].trim();
    }
    if (timeParts.length >= 2) {
      endTime = timeParts[1].trim();
    }

    // Build date string
    const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const startAtStr = `${dateStr}T${startTime}:00+02:00`;

    // Handle end time that might be early morning next day (00:00 - 06:00)
    let endAtStr: string | null = null;
    if (endTime) {
      const [endHour] = endTime.split(':').map(Number);
      if (endHour < 6) {
        // Likely next day (after midnight)
        const nextDate = new Date(year, monthNum - 1, day + 1);
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        endAtStr = `${nextDateStr}T${endTime}:00+02:00`;
      } else {
        endAtStr = `${dateStr}T${endTime}:00+02:00`;
      }
    }

    return { startAt: startAtStr, endAt: endAtStr };
  }

  /**
   * Extract description from the detail page
   */
  private extractDescription(html: string): string | null {
    // Description is in <div class="col wysiwyg-text">
    const descMatch = html.match(/<div\s+class="col wysiwyg-text">([^]*?)<\/div>\s*<\/section>/);
    if (descMatch) {
      // Extract text content and clean HTML
      let text = descMatch[1];
      // Remove HTML tags
      text = text.replace(/<[^>]+>/g, ' ');
      // Decode HTML entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      return text || null;
    }
    return null;
  }

  /**
   * Extract image URL from detail page
   */
  private extractImageUrl(html: string): string | null {
    // Look for og:image meta tag first
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (ogMatch) {
      return ogMatch[1];
    }

    // Fallback: extract from section-mentions or section-desc image
    const imgMatch = html.match(/<section\s+id="section-(?:mentions|desc)">[\s\S]*?<img\s+src="([^"]+)"/);
    if (imgMatch) {
      return imgMatch[1];
    }

    return null;
  }

  /**
   * Extract ticket/booking URL from detail page
   * Looks for links with text like "réserver", "Billetterie", "Tickets", "Réserver"
   * or links to known ticketing platforms (Shotgun, Dice, Eventbrite, Weezevent, Billetweb)
   */
  private extractTicketUrl(html: string): string | null {
    // First, look for a direct reservation link in section-header
    // Le Sucre uses: <a class="reservation" href="...">réserver</a>
    const reservationMatch = html.match(
      /<a\s+class="reservation"[^>]*href="([^"]+)"[^>]*>[^<]*(?:réserver|tickets|billetterie)[^<]*<\/a>/i
    );
    if (reservationMatch) {
      return reservationMatch[1];
    }

    // Fallback: look for any link containing common ticketing domains
    const ticketingDomains = [
      'shotgun.live',
      'dice.fm',
      'eventbrite',
      'weezevent',
      'billetweb',
      'ticketmaster',
    ];

    for (const domain of ticketingDomains) {
      const domainMatch = html.match(
        new RegExp(`<a[^>]*href="([^"]*${domain}[^"]*)"[^>]*>`, 'i')
      );
      if (domainMatch) {
        return domainMatch[1];
      }
    }

    // Fallback: look for any link with text containing "réserver", "tickets", or "billetterie"
    const textMatch = html.match(
      /<a[^>]*href="([^"]+)"[^>]*>[^<]*(?:réserver|tickets?|billetterie)[^<]*<\/a>/i
    );
    if (textMatch) {
      return textMatch[1];
    }

    return null;
  }
}
