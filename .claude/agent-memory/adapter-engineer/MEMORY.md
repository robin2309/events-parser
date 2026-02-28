# Adapter Engineer Memory

## Le Transbordeur (leTransbordeur)

**Venue**: https://www.transbordeur.fr
**Type**: Music/Concert Venue (Lyon, France)
**Status**: Adapter fixed - discovery() now correctly filters event links

### Bug Fix (Feb 8, 2025)

**Problem**: discover() was returning 27 URLs including navigation/static links:
- `/wp-json/`, `/acces/`, `/bar-food/`, `https://gmpg.org/xfn/11`, etc.
- Root cause: Regex `/href="([^"]*\/[a-z0-9-]+\/[a-z0-9-]*[^"]*)"[^>]*>/gi` matched ANY link with slashes

**Solution**: Use specific CSS class selector like leSucre adapter:
- Changed from overly broad regex to: `/<a[^>]*href="([^"]+)"[^>]*class="event-link"/g`
- Now only matches `<a ... class="event-link" ... href="...">` tags
- Prevents false positives from nav links, APIs, social media, etc.

### Key Implementation Details

1. **Event Link Pattern**: Event cards use `class="event-link"` consistently
   - e.g., `<a href="/carpenter-brut-2025/" class="event-link">Carpenter Brut</a>`
   - Fixtures confirmed this pattern in listing.html

2. **Listing Page Structure**:
   - Events in `<div class="component__items">` > `<div class="component__item">`
   - Each item has one `<a class="event-link">` with relative URL (e.g., `/carpenter-brut-2025/`)

3. **Event Detail Pages**: Contain JSON-LD MusicEvent with all needed data
   - Title, startDate/endDate, location, image all present
   - Ticketing via Digitick: `web.digitick.com`

4. **Test Coverage**: All 25 tests pass (discovery + extraction + validation)

### Testing Pattern

- Fixtures at `fixtures/leTransbordeur/`: listing.html and event.html
- Listing fixture has 3 event links + pagination (all non-events now filtered out)
- All required NormalizedEvent fields extracted correctly

### Known Limitations

- Agenda page is JS-rendered (events not in initial HTML)
- Current adapter handles pre-rendered listing HTML only
- For live scraping, would need Puppeteer to render before discovery()

## Grrrnd Zero (grrrndZero)

**Venue**: https://www.grrrndzero.org
**Type**: Independent concert venue/collective (Vaulx-en-Velin/Lyon, France)
**Status**: Adapter created - Complete with tests (29 tests passing)

### Implementation Strategy

1. **Discovery**: Uses Joomla RSS feed at `/index.php?format=feed&type=rss`
   - RSS feed has individual event items with `<link>` tags
   - Filters out main agenda page (/1477-agenda-gz) during discovery
   - Returns event detail page URLs

2. **Extraction**: Parses event detail pages for French dates/times
   - Dates in format: "jeu 05/03" or "samedi 14/03" (abbreviated or full day names)
   - Times in format: "(16h‑01h)" with Unicode en-dash or em-dash
   - Handles late night end times (< 6h) as next day timestamps
   - Extracts image from og:image meta tag or first <img> tag
   - Searches for ticketing keywords (billetterie, tickets, réserver, etc.)

3. **Key Selectors**:
   - Title: `<h1>` or `<title>` tag
   - Content: `<article>` wrapper
   - Image: og:image meta property or img src
   - Dates: Regex `/(?:jeu|sam|dimanche)\s+(\d{1,2})\/(\d{1,2})/i`
   - Time: `/\((\d{1,2})h[:\s-]?(\d{0,2})?(?:‑|—)?(\d{0,2})h?\)?/`

### Test Coverage

- **29 tests** covering all required fields and edge cases
- Metadata validation (adapter name, base URL, refresh group)
- Discovery from RSS with proper URL filtering
- Date/time parsing (French abbreviations and full names)
- Late night end times (next day handling)
- Missing field handling (graceful null returns)
- ISO 8601 format validation with timezone offset

### Fixtures Location

- `fixtures/grrrndZero/rss.xml` - Sample RSS feed with 3 events
- `fixtures/grrrndZero/event.html` - Sample event detail page (Big Science Daily Program, 28/02)

### Notes

- Uses RSS as primary discovery source (no web scraping of listing page)
- Event dates are always 2026 in fixtures (test data)
- Timezone: Europe/Paris (hardcoded for Lyon location)
- Location: Fixed to "Grrrnd Zero, 60 Avenue de Bohlen, 69120 Vaulx-en-Velin"
- All tests pass - 82 total tests in project (5 test files)
