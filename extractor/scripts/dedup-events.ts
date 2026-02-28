#!/usr/bin/env tsx
import { pool, closePool } from '../src/db/pool.js';
import readline from 'node:readline';

/**
 * Find duplicate events: same title on the same day (by start_at date).
 * For each group of duplicates, keep the one with the lowest id and delete the rest.
 */

interface DuplicateGroup {
  title: string;
  day: string;
  count: number;
  ids: number[];
  keepId: number;
  deleteIds: number[];
  urls: string[];
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  const { rows } = await pool.query(`
    SELECT
      e.id,
      e.title,
      e.event_url,
      e.start_at::date AS day
    FROM events e
    INNER JOIN (
      SELECT title, start_at::date AS day
      FROM events
      GROUP BY title, start_at::date
      HAVING COUNT(*) > 1
    ) dups ON e.title = dups.title AND e.start_at::date = dups.day
    ORDER BY e.title, dups.day, e.id
  `);

  if (rows.length === 0) return [];

  // Group by title + day
  const groups = new Map<string, DuplicateGroup>();
  for (const row of rows) {
    const key = `${row.title}|${row.day}`;
    if (!groups.has(key)) {
      groups.set(key, {
        title: row.title,
        day: row.day,
        count: 0,
        ids: [],
        keepId: row.id,
        deleteIds: [],
        urls: [],
      });
    }
    const group = groups.get(key)!;
    group.count++;
    group.ids.push(row.id);
    group.urls.push(row.event_url);
  }

  // For each group, keep lowest id, mark rest for deletion
  for (const group of groups.values()) {
    group.keepId = group.ids[0];
    group.deleteIds = group.ids.slice(1);
  }

  return Array.from(groups.values());
}

function printGroups(groups: DuplicateGroup[]): void {
  let totalToDelete = 0;

  for (const group of groups) {
    console.log(`\n  "${group.title}" on ${group.day} — ${group.count} entries`);
    for (let i = 0; i < group.ids.length; i++) {
      const marker = group.ids[i] === group.keepId ? 'KEEP' : 'DELETE';
      console.log(`    [${marker}] id=${group.ids[i]}  ${group.urls[i]}`);
    }
    totalToDelete += group.deleteIds.length;
  }

  console.log(`\n  Total: ${groups.length} duplicate group(s), ${totalToDelete} row(s) to delete\n`);
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function deleteDuplicates(groups: DuplicateGroup[]): Promise<number> {
  const idsToDelete = groups.flatMap((g) => g.deleteIds);
  if (idsToDelete.length === 0) return 0;

  const { rowCount } = await pool.query(
    `DELETE FROM events WHERE id = ANY($1::bigint[])`,
    [idsToDelete]
  );
  return rowCount ?? 0;
}

async function main() {
  console.log('Searching for duplicate events (same title + same day)...\n');

  const groups = await findDuplicates();

  if (groups.length === 0) {
    console.log('No duplicates found.');
    await closePool();
    return;
  }

  printGroups(groups);

  const confirmed = await askConfirmation('Proceed with deletion? (y/N) ');

  if (!confirmed) {
    console.log('Aborted.');
    await closePool();
    return;
  }

  const deleted = await deleteDuplicates(groups);
  console.log(`Deleted ${deleted} duplicate row(s).`);
  await closePool();
}

main().catch(async (err) => {
  console.error('Error:', err);
  await closePool();
  process.exit(1);
});
