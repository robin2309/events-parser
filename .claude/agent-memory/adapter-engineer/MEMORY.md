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
