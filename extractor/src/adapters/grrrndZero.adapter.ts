import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';
import { BaseAdapter } from './base.js';
import { generateContentHash } from '../utils/hashing.js';

/**
 * Grrrnd Zero venue adapter for https://www.grrrndzero.org
 * Lyon-based independent concert venue/collective space
 *
 * Discovery + extraction both work from the RSS feed.
 * The first <item> is a summary agenda page and is skipped.
 * Each subsequent <item> is an individual event with:
 *   - title containing date + name (e.g. "SAM 28/02 : BIG SCIENCE DAILY PROGRAM")
 *   - description CDATA containing <img> poster, time, price, artist info
 */
export class GrrrndZeroAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'grrrndZero',
    baseUrl: 'https://www.grrrndzero.org',
    displayName: 'Grrrnd Zero',
    refreshGroup: 1,
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    try {
      this.log(ctx, 'info', 'Fetching RSS feed');

      const response = await ctx.http.get(`${this.meta.baseUrl}/index.php?format=feed&type=rss`);

      if (response.status !== 200) {
        this.log(ctx, 'warn', `Failed to fetch RSS feed: ${response.status}`);
        return [];
      }

      const items = this.parseRssItems(response.body);

      // Skip the first item (agenda summary page)
      const eventItems = items.slice(1);
      const urls = eventItems
        .map((item) => item.link)
        .filter((url): url is string => url !== null);

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
      // The runner fetches the event detail page, but we can also be called
      // with RSS description HTML. Try og:image from the detail page first,
      // then fall back to <img> in the HTML body.
      const title = this.extractTitle(html);
      const { startAt, endAt } = this.extractDateTime(html);
      const description = this.extractDescription(html);
      const imageUrl = this.extractImageUrl(html);
      const ticketUrl = this.extractTicketUrl(html);

      const now = ctx.now();
      const isoNow = this.getIsoTimestamp(now);

      const urlMatch = eventUrl.match(/\/(\d+)-([^/]+)(?:\/)?$/);
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
        locationName: 'Grrrnd Zero',
        locationAddress: '60 Avenue de Bohlen, 69120 Vaulx-en-Velin, France',
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
   * Parse RSS XML into structured items
   */
  private parseRssItems(xml: string): RssItem[] {
    const itemRegex = /<item>[\s\S]*?<\/item>/g;
    const rawItems = xml.match(itemRegex) || [];

    return rawItems.map((raw) => {
      const titleMatch = raw.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
        || raw.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = raw.match(/<link>(https?:\/\/[^<]+)<\/link>/);
      const descMatch = raw.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
        || raw.match(/<description>([\s\S]*?)<\/description>/);

      return {
        title: titleMatch ? titleMatch[1].trim() : null,
        link: linkMatch ? linkMatch[1].trim() : null,
        description: descMatch ? descMatch[1].trim() : null,
      };
    });
  }

  private extractTitle(html: string): string {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return h1Match[1].trim();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const full = titleMatch[1];
      const parts = full.split(/\s*[|—-]\s*/);
      return parts[0].trim();
    }

    return 'Untitled Event';
  }

  private extractDateTime(html: string): { startAt: string; endAt: string | null } {
    // Pattern: abbreviated day + DD/MM, e.g. "sam 28/02" or "jeu 05/03"
    const datePattern = /(?:lun|mar|mer|jeu|ven|sam|dim)\.?\s+(\d{1,2})\/(\d{1,2})/i;
    const dateMatch = html.match(datePattern);

    let day = 1;
    let month = 1;

    if (dateMatch) {
      day = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10);
    } else {
      // Full day names
      const fullMatch = html.match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\/(\d{1,2})/i);
      if (fullMatch) {
        day = parseInt(fullMatch[1], 10);
        month = parseInt(fullMatch[2], 10);
      }
    }

    // Time: "(16h‑01h)" or "(20h)" or "19h"
    let startHour = 20;
    let startMin = 0;
    let endHour: number | null = null;
    let endMin = 0;

    // Try range inside parens: (16h-01h) or (16h‑01h)
    const rangeMatch = html.match(/(\d{1,2})h(\d{2})?\s*[‑–—-]\s*(\d{1,2})h(\d{2})?/);
    if (rangeMatch) {
      startHour = parseInt(rangeMatch[1], 10);
      startMin = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
      endHour = parseInt(rangeMatch[3], 10);
      endMin = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;
    } else {
      // Single time: "20h" or "19h"
      const singleMatch = html.match(/(\d{1,2})h(\d{2})?/);
      if (singleMatch) {
        startHour = parseInt(singleMatch[1], 10);
        startMin = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
      }
    }

    const year = new Date().getFullYear();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const startAtStr = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+02:00`;

    let endAtStr: string | null = null;
    if (endHour !== null) {
      if (endHour < 6) {
        const nextDate = new Date(year, month - 1, day + 1);
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        endAtStr = `${nextDateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00+02:00`;
      } else {
        endAtStr = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00+02:00`;
      }
    }

    return { startAt: startAtStr, endAt: endAtStr };
  }

  private extractDescription(html: string): string | null {
    const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (contentMatch) {
      let text = contentMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 0) return text.substring(0, 500);
    }

    const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/);
    if (pMatch) return pMatch[1].trim().substring(0, 500);

    return null;
  }

  /**
   * Extract image URL from the page.
   * 1. og:image meta tag (either attribute order)
   * 2. First <img> in article/content area (skip tiny icons)
   * 3. First <img> anywhere on the page
   */
  private extractImageUrl(html: string): string | null {
    // og:image — either attribute order
    const ogMatch = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/);
    if (ogMatch) {
      const url = ogMatch[1] || ogMatch[2];
      return url.startsWith('http') ? url : `${this.meta.baseUrl}${url}`;
    }

    // Images inside article or main content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    const searchArea = articleMatch ? articleMatch[1] : html;

    // Find all <img> tags and pick the first with a real image path (not icons/logos)
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(searchArea)) !== null) {
      const src = imgMatch[1];
      // Skip tiny images, icons, tracking pixels
      if (src.includes('icon') || src.includes('logo') || src.includes('pixel') || src.includes('spacer')) {
        continue;
      }
      return src.startsWith('http') ? src : `${this.meta.baseUrl}${src}`;
    }

    return null;
  }

  private extractTicketUrl(html: string): string | null {
    const keywords = ['billetterie', 'tickets?', 'réserver', 'entry', 'entrée', 'paf', 'prix'];
    for (const keyword of keywords) {
      const match = html.match(
        new RegExp(`<a[^>]*href="([^"]+)"[^>]*>[^<]*(?:${keyword})[^<]*<\\/a>`, 'i')
      );
      if (match) return match[1];
    }

    const domains = ['shotgun.live', 'dice.fm', 'eventbrite', 'weezevent', 'billetweb', 'ticketmaster', 'resident.advisor', 'bandcamp.com'];
    for (const domain of domains) {
      const match = html.match(new RegExp(`<a[^>]*href="([^"]*${domain}[^"]*)"[^>]*>`, 'i'));
      if (match) return match[1];
    }

    return null;
  }
}

interface RssItem {
  title: string | null;
  link: string | null;
  description: string | null;
}
