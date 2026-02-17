CREATE TABLE IF NOT EXISTS events (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id        TEXT NOT NULL,
  source_event_id  TEXT,
  event_url        TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ,
  timezone         TEXT NOT NULL,
  image_url        TEXT,
  location_name    TEXT,
  location_address TEXT,
  ticket_url       TEXT,
  status           TEXT DEFAULT 'active',
  fetched_at       TIMESTAMPTZ NOT NULL,
  last_seen_at     TIMESTAMPTZ NOT NULL,
  content_hash     TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (source_id, event_url)
);
