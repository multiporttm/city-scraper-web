You are an expert web engineer helping build a production-quality web-scraping project.

You write clean, simple, maintainable code. You prioritize clarity over unnecessary abstraction as we will develop the app feature by feature.

You should think like a senior front-end developer, but explain and implement like you are building with a beginner.

# Project Overview

We are building a web app that searches for events local to a user's location (focusing and testing on New York City first) inspired by apps like Luma, Meetup, and Partiful.

Users sign in, take a short quiz to understand their preferences, then browse through recommended events on their dashboard, view their pinned events, and can edit their preferences in user settings.

# Tech Stack
Use the following stack:
+ Plain HTML, CSS and TypeScript in the browser (no UI framework), bundled with esbuild
+ Apple Maps (MapKit JS) for the map, with Leaflet + OpenStreetMap as the fallback when Apple keys aren't set
+ Cloudflare Workers (static assets + a Worker for `/api/*`), deployed with Wrangler
+ localStorage for saved state (through the small store in `web/store.ts`)
+ Server-side Worker routes for secrets, tokens, and AI calls

Do not introduce new major libraries unless there is a strong reason.

# Architecture Guidelines
Use this structure unless there is a strong reason to change it:
```
public/          static files served as-is (index.html, images/), plus build/ output
web/             the browser app
    screens/     one file per screen (sign-in, quiz, explore, pinned, settings)
    components/  reusable UI (event card, sheet, map, preference inputs)
worker/          the Cloudflare Worker (API routes)
lib/             shared logic: scrapers, ranking, categorizing, times
constants/
data/
types/
```
### web/screens/
Screens compose components and read/write the stores in `web/state.ts`, but should not contain large reusable UI blocks or complex business logic.

### web/components/
Create a component only when:
+ it is reused in multiple places
+ it makes a screen easier to read
+ it represents a clear UI concept like ```eventCard```, ```openSheet```, or ```EventMap```

# Styling Rules
All styles live in ```web/styles.css``` as plain CSS, using BEM class names (e.g. ```.empty-state__title```). Avoid inline styles unless a value is dynamic (e.g. a card's tilt or a pin's color).

Prioritize clean, readable, mobile UI that also works on desktop (center content, cap widths).

When building from an attached design image:
+ match spacing closely
+ match typography hierarchy
+ match border radius and shadows
+ match layout structure
+ use consistent reusable styles
+ make the UI responsive for different screen sizes

# UI Quality Bar
The app should feel: playful, polished, friendly, mobile, visually close to the provided design references

Use rounded cards, soft shadows, clear spacing, progress indicators, friendly empty states, large touch targets, and simple animations when useful.

# Image Rule
App images live in ```public/images/``` and are referenced by URL (e.g. ```/images/pinned-icons.png```). Single-color icons are drawn with ```tintedImage(name)``` from ```web/dom.ts``` so they take the text color. Category and UI icons are Ionicons, registered in ```web/icons.ts```.

### data/
Use this for harcoded data
Example:
```
data/
    preferences.ts
```

# TypeScript Rules
Use TypeScript strictly.
Avoid ```any```.
Keep types simple and readable.

# Feature Implementation Rules
When the user asks to build a feature:
1. Read this file first
2. Identify files to change
3. Keep changes focused
4. Do not rewrite unrelated code
5. Follow existing patterns
6. Ensure features work end-to-end
7. Fix errors before finishing

After signing in, the app begins with a short quiz to learn more information about the user and their preferences. It asks:
+ Where they are located and how far are they willing to commute for events
+ When is their availability: which days, and during what time frames?
+ What are their interests? Where users are presented with a grid of capsule shaped options (such as Running, Movies, or Finance), and as they tap on options, more similar suggestions appear.

More app details:
Your plan touches a few decisions that change the architecture a lot, especially the data sourcing, so I'm going to ask four quick questions before writing it up.

Here's the plan, assuming **NYC** as the launch metro (swap in another city if you prefer). It's built around Expo, Supabase with PostGIS, Python scraping workers, and rules-based ranking.

## 1. Architecture

```
Scrapers (Python, scheduled) → raw store → normalize/extract → dedupe/geocode/tag → Supabase Postgres
                                                                                        ↓
                                      Expo app ← ranking RPC (PostGIS + scoring) ← events table
```

**Mobile app (Expo, TypeScript)**
- Expo Router, TanStack Query for data, Zustand for local state
- Supabase anonymous auth at first, upgraded to email or Apple sign-in later so users can keep pins
- expo-notifications for reminders, expo-calendar for "add to calendar"

**Backend (Supabase)**
- Postgres with PostGIS for radius queries
- Row-level security so users only see their own preferences and pins
- A `recommend_events(user_id, limit, offset)` SQL function that does hard filtering and scoring server-side

**Workers (Python)**
- `httpx` and `selectolax` for static pages, Playwright for JS-heavy ones
- Run on GitHub Actions cron to start (free), then move to Fly.io or Railway when you need more frequency
- Anthropic API (Haiku-tier) for turning messy captions and posts into structured events

## 2. Data model

- `profiles`: `home_point` (geography), `radius_km`, `availability` (JSON weekly grid: 7 days × morning/afternoon/evening/late), `interests` (text[]), `onboarded_at`
- `events`: title, description, `start_at`, `end_at`, venue name, `location` (geography), url, image, price_min/max, `source`, `source_id`, `categories` (text[]), `dedupe_key`, `raw` (jsonb), `scraped_at`, `status`
- `pins`: `user_id`, `event_id`, `created_at`
- `interactions`: view / pin / dismiss / click-through (this feeds ranking later)
- `source_runs`: per-run counts, errors, duration (for monitoring)

## 3. The three screens (plus quiz)

- **Onboarding quiz** (4 steps): location (autocomplete or GPS), commute radius (slider with travel-time hints), weekly availability (tap-to-toggle grid), interests (chip picker from a fixed taxonomy plus free text)
- **Dashboard**: feed of ranked event cards, with "Today / This weekend / This week" tabs, category chips, a list/map toggle, pin and dismiss actions, and pull-to-refresh
- **Pinned**: upcoming events sorted by date, past ones collapsed below, with reminders, add to calendar, share, and unpin
- **Settings**: edit every quiz answer, notification toggles, reset or delete data

## 4. Scraping layer (the core)

Every source is an adapter with the same interface: `discover() → fetch() → parse() → Event[]`. That keeps each source isolated, so when one breaks it doesn't take the others down.

**Tier 1: structured and public (build first)**
- **Luma**: city and calendar pages expose event JSON in the page payload
- **Eventbrite**: listing pages carry JSON-LD `Event` markup
- **Meetup**: public search and group pages (embedded Next.js data)
- **Reddit**: `.json` endpoints on r/nyc, r/AskNYC, r/nycevents and similar, plus the free API; use LLM extraction on posts
- **Others worth adding**: Dice, Resident Advisor, Songkick, venue and promoter sites, library and university calendars, Time Out, Do212, Ticketmaster and SeatGeek APIs (free keys, easy wins)

**Tier 2: hard (build after the pipeline works)**
- **Instagram**: public discovery without login is very limited. The workable approach is a curated list of NYC venue and organizer accounts, pulling their posts and running captions and flyer text through LLM extraction. Expect login walls and rate limits.
- **Facebook**: public event pages are heavily gated and anti-bot. This has the worst return for the effort, so do it last or skip it.
- **Partiful**: most events are invite-only links with no public discovery. The practical route is letting users paste a Partiful link into the app to import it, plus ingesting any public ones you can find.

One option for Tier 2: use a paid scraping provider (Apify actors, Bright Data, etc.) instead of running your own account pools and proxies. At small scale it's often cheaper than the time you'd spend fighting bans, and it keeps that fragility out of your codebase. Also, scraping with logged-in throwaway accounts tends to get those accounts banned fast, so treat Instagram and Facebook data as best-effort rather than something the app depends on.

**Processing pipeline (shared by all sources)**
1. **Store raw**: keep the HTML or JSON so you can re-parse without re-fetching
2. **Normalize**: timezones (everything to UTC with the venue's local zone), price parsing, URL cleanup
3. **LLM extraction**: for unstructured text, output strict JSON (title, start/end, venue, address, price, category) with a confidence score; drop low-confidence results
4. **Geocode**: Mapbox or Google, cached by venue string
5. **Categorize**: map to your interest taxonomy (rules first, LLM fallback)
6. **Dedupe**: the same event shows up on Luma, Instagram, and Reddit; match on fuzzy title + start time window + venue distance (`rapidfuzz`), merge into one record with multiple source links
7. **Expire**: mark past events inactive nightly

**Reliability**
- Schedule: Tier 1 every few hours, Tier 2 daily
- Alert when a source's yield drops by more than about 50% versus its average (that means a layout change)
- Backoff and caching so you don't hammer sites

## 5. Ranking (v1, rules-based)

Hard filters: within radius, not in the past, overlaps the user's availability, not dismissed.

Score = weighted sum of:
- Interest match (category overlap, plus keyword match on title and description)
- Distance decay (closer is better)
- Availability fit (fully inside a free slot beats partial)
- Soft boosts: starting soon, free or cheap, multi-source (a popularity signal)
- A small randomness/novelty term so the feed doesn't go stale

Later: use pins and dismissals to adjust per-category weights, then consider embeddings.

## 6. Phases

1. **Foundation**: Expo app, Supabase schema, auth, CI, repo layout (`/app`, `/workers`, `/supabase`)
2. **App shell with seed data**: quiz, three screens, ranking function against hand-loaded events
3. **Tier 1 ingestion**: Luma, Eventbrite, Meetup, Reddit, plus the processing pipeline and dedupe
4. **Quality pass**: tune ranking, categorization accuracy, monitoring dashboard, map view
5. **Tier 2 sources**: Instagram venue list, Partiful link import, Facebook if worthwhile
6. **Polish and ship**: notifications, calendar export, TestFlight and Android internal testing

## 7. Main risks

- **Scraper fragility**: expect to fix adapters regularly; the monitoring in section 4 is what keeps this manageable
- **Data quality**: duplicates and wrong dates hurt trust more than missing events, so lean on confidence thresholds
- **Social coverage**: Instagram and Facebook will be incomplete no matter how much effort goes in, so don't let the app's value depend on them
- **App Store review**: apps that visibly rely on scraped data can raise questions, so link out to original sources and show attribution

Want me to scaffold the repo next (Expo app, Supabase migrations for the schema above, and the first Python adapters for Luma and Eventbrite), or turn this plan into a shareable doc first?