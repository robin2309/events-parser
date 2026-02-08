# Events Aggregator

Event aggregator scaffold with adapter pattern for ingesting events from multiple venue websites.

## Installation

```bash
pnpm install
```

## Project Structure

```
/src
  /adapters       - Venue-specific adapters
  /config         - Configuration management
  /extractors     - HTML/JSON-LD parsing utilities
  /ingest         - CLI and ingestion runner
  /types          - TypeScript interfaces
  /utils          - Shared utilities
/tests            - Test files
/fixtures         - Test fixtures (sample HTML)
```

## Development

### Build

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

## CLI Commands

### Run ingestion for a specific adapter

```bash
pnpm ingest:run-source exampleVenue
```

### Run ingestion for a refresh group (0-3)

```bash
pnpm ingest:run-group 0
```

**Note:** CLI commands currently use placeholder implementations and will only log intended actions.

## Adding a New Adapter

1. **Create adapter file** in `src/adapters/yourVenue.adapter.ts`:

```typescript
import { BaseAdapter } from './base.js';
import type { NormalizedEvent } from '../types/event.js';
import type { AdapterContext, SourceMeta } from '../types/source.js';

export class YourVenueAdapter extends BaseAdapter {
  readonly meta: SourceMeta = {
    adapterName: 'yourVenue',
    baseUrl: 'https://your-venue.com',
    displayName: 'Your Venue Name',
    refreshGroup: 0, // 0-3 for rolling schedule
  };

  async discover(ctx: AdapterContext): Promise<string[]> {
    // Fetch listing pages and extract event URLs
    return [];
  }

  async extract(
    ctx: AdapterContext,
    eventUrl: string,
    html: string
  ): Promise<NormalizedEvent[]> {
    // Parse event detail page and return normalized event
    return [];
  }
}
```

2. **Register adapter** in `src/adapters/registry.ts`:

```typescript
import { YourVenueAdapter } from './yourVenue.adapter.js';

// In registerDefaults() method:
this.register(new YourVenueAdapter());
```

3. **Add test fixtures** in `fixtures/yourVenue/`:
   - `listing.html` - Sample listing page
   - `event.html` - Sample event detail page

4. **Run the adapter**:

```bash
pnpm ingest:run-source yourVenue
```

## Adapter Contract

Each adapter must:

- Extend `BaseAdapter`
- Define `meta` with adapterName, baseUrl, etc.
- Implement `discover(ctx)` - returns event detail URLs
- Implement `extract(ctx, url, html)` - returns normalized events

## Event Schema

All adapters must return `NormalizedEvent` objects with:

- `sourceId` - Adapter name
- `eventUrl` - Canonical event URL
- `title` - Event title
- `startAt` - ISO 8601 datetime with timezone
- `timezone` - IANA timezone (e.g., "America/New_York")
- `fetchedAt` - ISO timestamp
- `lastSeenAt` - ISO timestamp
- `contentHash` - SHA-256 hash for change detection

See `src/types/event.ts` for full schema.

## Next Steps

This is a **scaffold only**. To build the full aggregator:

1. Add database integration (Postgres/Prisma recommended)
2. Implement real scraping logic in adapters
3. Add API server (Fastify/Express) for frontend
4. Implement scheduling/cron for rolling refresh
5. Add duplicate detection and change tracking
6. Consider adding proxy rotation for rate limiting

## License

MIT
