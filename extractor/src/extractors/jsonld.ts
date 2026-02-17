/**
 * Extract JSON-LD Event structured data from HTML
 */
export function extractJsonLdEvents(html: string): unknown[] {
  const events: unknown[] = [];

  // Match all <script type="application/ld+json"> blocks
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches = html.matchAll(scriptRegex);

  for (const match of matches) {
    try {
      const jsonContent = match[1]?.trim();
      if (!jsonContent) continue;

      const data = JSON.parse(jsonContent);

      // Check if it's an Event or array containing Events
      if (Array.isArray(data)) {
        events.push(...data.filter(isEventType));
      } else if (isEventType(data)) {
        events.push(data);
      }
    } catch (err) {
      // Skip invalid JSON blocks
      continue;
    }
  }

  return events;
}

/**
 * Type guard: check if data represents an Event
 */
function isEventType(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Check for @type or type property indicating Event
  const type = obj['@type'] || obj.type;
  if (!type) return false;

  if (typeof type === 'string') {
    return type === 'Event' || type.endsWith('/Event');
  }

  if (Array.isArray(type)) {
    return type.some((t) => t === 'Event' || (typeof t === 'string' && t.endsWith('/Event')));
  }

  return false;
}

/**
 * Extract event fields from JSON-LD Event object
 */
export interface JsonLdEvent {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string | { url?: string } | Array<{ url?: string }>;
  location?: {
    name?: string;
    address?: string | { streetAddress?: string; addressLocality?: string };
  };
  url?: string;
  eventStatus?: string;
}
