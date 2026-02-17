import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export { pool };

export async function closePool(): Promise<void> {
  await pool.end();
}
