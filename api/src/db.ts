import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://events:events@localhost:5432/events',
});

export const events = pgTable('events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  sourceId: text('source_id').notNull(),
  sourceEventId: text('source_event_id'),
  eventUrl: text('event_url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  timezone: text('timezone').notNull(),
  imageUrl: text('image_url'),
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  ticketUrl: text('ticket_url'),
  status: text('status').default('active'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const db = drizzle(pool);

export async function closeDb() {
  await pool.end();
}
