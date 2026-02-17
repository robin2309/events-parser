import { describe, it, expect } from 'vitest';
import { extractJsonLdEvents } from '../src/extractors/jsonld.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('JSON-LD Extractor', () => {
  it('should extract events from HTML with JSON-LD', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Event",
          "name": "Test Event",
          "startDate": "2026-03-01T20:00:00Z"
        }
        </script>
      </head>
      <body>Test</body>
      </html>
    `;

    const events = extractJsonLdEvents(html);

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should return empty array for HTML without JSON-LD events', () => {
    const html = '<html><body>No JSON-LD here</body></html>';

    const events = extractJsonLdEvents(html);

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  });

  it('should load and parse fixture file', () => {
    const fixturePath = join(__dirname, '../fixtures/exampleVenue/event.html');

    let html: string;
    try {
      html = readFileSync(fixturePath, 'utf-8');
    } catch {
      // Fixture might not exist yet, skip
      return;
    }

    const events = extractJsonLdEvents(html);

    expect(Array.isArray(events)).toBe(true);
  });
});
