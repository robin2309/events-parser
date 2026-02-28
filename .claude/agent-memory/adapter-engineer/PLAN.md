# Auditorium de Lyon Adapter - Implementation Plan

## Task: Create adapter for Auditorium de Lyon (auditorium-lyon.com)

**Venue URL**: https://www.auditorium-lyon.com/fr/programmation?type=All&saison=448
**Adapter Name**: auditoriumLyon

## Step 1: Fetch & Analyze Listing Page
- [ ] Get HTML from listing URL
- [ ] Identify event link selectors (CSS classes or patterns)
- [ ] Understand pagination (if any)
- [ ] Extract all event detail URLs

## Step 2: Analyze Event Detail Pages
- [ ] Fetch a sample event detail page
- [ ] Look for JSON-LD Event blocks first (priority 1)
- [ ] If missing, identify HTML selectors for:
  - Title, startDate/endTime
  - Location, description
  - Image URL
  - Ticket/booking link
- [ ] Check if page is JS-rendered (may need Puppeteer)

## Step 3: Create Adapter
- [ ] Implement `discover()` - extract event URLs from listing
- [ ] Implement `extract()` - parse event detail page
- [ ] Use priority extraction order:
  1. Structured sources (RSS/API on same domain)
  2. JSON-LD Event
  3. HTML selectors
  4. Puppeteer (only if necessary)

## Step 4: Create Fixtures
- [ ] Save listing.html sample
- [ ] Save event.html sample (one representative event)

## Step 5: Write Tests
- [ ] Test discover() - validate URL extraction
- [ ] Test extract() - validate NormalizedEvent shape
- [ ] All required fields: title, startAt, timezone, eventUrl, ticketUrl, contentHash, fetchedAt, lastSeenAt

## Step 6: Register Adapter
- [ ] Update registry.ts to import and register AuditoriumLyonAdapter

## Step 7: Verify
- [ ] Run tests
- [ ] Confirm all tests pass
- [ ] Check git status

## BLOCKING: Need HTML fixtures

To proceed, I need actual HTML samples from the venue website:
1. **listing.html** - HTML from the programmation page with 3-5 event listings
2. **event.html** - HTML from a single event detail page

Without these, I cannot proceed with accurate adapter development.
