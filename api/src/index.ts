import express from 'express';
import { db, events, closeDb } from './db.js';
import { gte, lte, asc, and } from 'drizzle-orm';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.get('/events', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (typeof from !== 'string' && typeof to !== 'string') {
      res.status(400).json({ error: 'Bad request' });
      return;
    }

    const fromDate = typeof from === 'string' ? new Date(from) : null;
    const toDate = typeof to === 'string' ? new Date(to) : null;

    if ((typeof from === 'string' && isNaN(fromDate!.getTime())) ||
        (typeof to === 'string' && isNaN(toDate!.getTime()))) {
      res.status(400).json({ error: 'Invalid date format. Use ISO 8601 (e.g. 2026-03-01)' });
      return;
    }

    const conditions = [];

    if (fromDate) {
      conditions.push(gte(events.startAt, fromDate));
    }

    if (toDate) {
      conditions.push(lte(events.startAt, toDate));
    }

    const result = await db
      .select()
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(events.startAt));

    res.json(result);
  } catch (error) {
    console.error('Query failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => closeDb());
});
