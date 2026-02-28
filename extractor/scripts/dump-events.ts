#!/usr/bin/env tsx
import { pool, closePool } from '../src/db/pool.js';

const sourceId = process.argv[2];
if (!sourceId) {
  console.error('Usage: tsx scripts/dump-events.ts <sourceId>');
  process.exit(1);
}

async function main() {
  const { rows } = await pool.query(
    `SELECT title, start_at, end_at, image_url, location_name, location_address, ticket_url, event_url, description
     FROM events WHERE source_id = $1 ORDER BY start_at`,
    [sourceId]
  );

  for (const row of rows) {
    console.log('---');
    console.log('Title:      ', row.title);
    console.log('Start:      ', row.start_at);
    console.log('End:        ', row.end_at);
    console.log('Image:      ', row.image_url);
    console.log('Location:   ', row.location_name);
    console.log('Address:    ', row.location_address);
    console.log('Ticket:     ', row.ticket_url);
    console.log('URL:        ', row.event_url);
    console.log('Description:', row.description ? row.description.substring(0, 150) + '...' : null);
  }
  console.log('---');
  console.log(`Total: ${rows.length} events for ${sourceId}`);
  await closePool();
}

main().catch(async (err) => {
  console.error('Error:', err);
  await closePool();
  process.exit(1);
});
