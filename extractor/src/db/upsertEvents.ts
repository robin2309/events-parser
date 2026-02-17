import { pool } from './pool.js';
import type { NormalizedEvent } from '../types/event.js';

const UPSERT_SQL = `
  INSERT INTO events (
    source_id, source_event_id, event_url, title, description,
    start_at, end_at, timezone, image_url, location_name,
    location_address, ticket_url, status, fetched_at, last_seen_at, content_hash
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  ON CONFLICT (source_id, event_url) DO UPDATE SET
    title        = EXCLUDED.title,
    description  = EXCLUDED.description,
    start_at     = EXCLUDED.start_at,
    end_at       = EXCLUDED.end_at,
    image_url    = EXCLUDED.image_url,
    ticket_url   = EXCLUDED.ticket_url,
    status       = EXCLUDED.status,
    last_seen_at = EXCLUDED.last_seen_at,
    content_hash = EXCLUDED.content_hash,
    updated_at   = NOW()
`;

export async function upsertEvents(events: NormalizedEvent[]): Promise<number> {
  let count = 0;

  for (const e of events) {
    await pool.query(UPSERT_SQL, [
      e.sourceId,
      e.sourceEventId ?? null,
      e.eventUrl,
      e.title,
      e.description ?? null,
      e.startAt,
      e.endAt ?? null,
      e.timezone,
      e.imageUrl ?? null,
      e.locationName ?? null,
      e.locationAddress ?? null,
      e.ticketUrl ?? null,
      e.status ?? 'active',
      e.fetchedAt,
      e.lastSeenAt,
      e.contentHash,
    ]);
    count++;
  }

  return count;
}
