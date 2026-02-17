/**
 * Normalized event structure for all ingested events
 */
export interface NormalizedEvent {
  /** Unique identifier for the source/adapter */
  sourceId: string;

  /** Optional external event ID from the source site */
  sourceEventId?: string | null;

  /** Canonical URL for the event */
  eventUrl: string;

  /** Event title */
  title: string;

  /** Event description/body */
  description?: string | null;

  /** Start datetime in ISO 8601 format (with timezone or UTC Z) */
  startAt: string;

  /** End datetime in ISO 8601 format */
  endAt?: string | null;

  /** IANA timezone string (e.g., "Europe/Paris", "America/New_York") */
  timezone: string;

  /** Primary image URL */
  imageUrl?: string | null;

  /** Venue/location name */
  locationName?: string | null;

  /** Physical address */
  locationAddress?: string | null;

  /** Ticket/booking URL */
  ticketUrl?: string | null;

  /** Event status */
  status?: 'active' | 'cancelled' | 'hidden';

  /** When this event was first fetched */
  fetchedAt: string;

  /** Last time this event was seen during a scrape */
  lastSeenAt: string;

  /** Hash of normalized content for change detection */
  contentHash: string;
}

/**
 * Raw event data before normalization
 */
export interface RawEventData {
  [key: string]: unknown;
}
