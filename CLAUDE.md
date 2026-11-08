# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the full project rules (product overview, tech stack, UI quality bar, quiz flow). Read it before building a feature. The essentials are summarized below.

## README

**Don't change `README.md`'s text unless the user asks for it.** That includes its wording, links, and adding sections (setup, deploy, local-run instructions or anything else). Replacing the screenshot image files in `screenshots/` when asked is fine, but leave the README's prose and `<img>` tags as they are. Setup and deploy notes for developers belong in this file instead.

## Commands

- `npm run dev` — builds the browser app and runs the site + Pages Functions locally with `wrangler pages dev` (http://localhost:8788)
- `npm run watch` — rebuilds the browser app on changes (run alongside `dev`)
- `npm run build` — bundles `web/` into `public/build/` with esbuild (`build.mjs`); this is the Cloudflare Pages build command, output directory `public`
- **`public/build/` is committed.** After changing anything the browser app uses (`web/`, `lib/`, `data/`, `constants/`, `types/`), run `npm run build` and commit `public/build/` with the change, so the deployed site never depends on Cloudflare's build step running.
- `npm run typecheck` — `tsc` for the browser app (`tsconfig.json`) and the functions/server code (`functions/tsconfig.json`), strict mode
- `npm run deploy` — builds and deploys with `wrangler pages deploy` (normally deploys happen from the Cloudflare dashboard's Git integration)
- There is no test runner or linter configured yet.

## Current state

A plain HTML/CSS/TypeScript single-page app (no UI framework) hosted on Cloudflare Pages, deployed from the dashboard's Git integration. It was converted from an Expo / React Native app; the screens, behaviour and look are the same.

- `public/index.html` is the only page. `web/main.ts` routes by pathname (`/sign-in`, `/quiz`, `/`, `/pinned`, `/settings`); Pages serves `index.html` for unknown paths because there's no top-level `404.html` (keep it that way).
- State lives in small persisted stores (`web/store.ts`, localStorage), defined in `web/state.ts` (auth, profile, preferences, pinned/archived events). Sign-in is a local stand-in (just a first name).
- `web/feed.ts` fetches `/api/events` with the saved preferences and refetches when they change. The server returns each event with its ranking `score`; the browser then re-ranks with `lib/personalize.ts`: learned taste (categories and hosts the user pins or archives, kept in the `taste` store and updated by `pin`/`archive`/`unpin`/`undoArchive` in `web/state.ts`), plus optional age and gender from the profile. Taste is applied when the feed loads (not after each swipe, so the stack doesn't reshuffle); a profile change re-ranks immediately.
- Age and gender are optional, set in the quiz's first step ("Tell us about you") or Settings → Edit Profile (`web/components/aboutInputs.ts`), and never leave the browser. They only act on events that explicitly target an age or gender (21+, "ages 25-35", "women's run club"...), never to guess interests. Keep it that way, and keep the matching phrases specific (see the comments in `lib/personalize.ts`).
- Explore (`web/screens/explore.ts`) is a map under a stack of tilted cards. The map is Apple Maps (MapKit JS, `web/components/appleMap.ts`) when the `APPLE_MAPKIT_*` secrets are set and `functions/api/mapkit-token.ts` signs tokens (`server/mapkitToken.ts`); otherwise `web/components/eventMap.ts` falls back to MapLibre drawing OpenFreeMap's free vector data, repainted in an Apple Maps-like dark palette by `mapStyle.ts`, with labels in the LandUI Pro font (glyph files in `public/fonts/`, made from `assets/fonts/` by `scripts/build-map-glyphs.mjs`) (`fallbackMap.ts`, loaded as a separate chunk only when needed). Both implement `MapBackend` in `mapShared.ts`. MapKit's types are hand-written in `web/mapkit.d.ts`. Drag/swipe right pins, left archives (`web/components/swipe.ts`); arrow keys do the same on desktop.

Events are scraped on demand by a Pages Function (`functions/api/events.ts` → `server/events.ts`, `GET /api/events?location=&distance=&days=&times=&interests=`, the raw preference strings). It calls `lib/scrapers/` (one adapter per source), normalizes to `EventItem` (`lib/scrapers/normalize.ts`, categories from `lib/categorize.ts`), then filters and ranks by distance/availability/interests (`lib/ranking.ts`). Sources: Luma (its internal discover API, by coordinates), Meetup (GraphQL `api.meetup.com/gql-ext`), Eventbrite (NYC search pages' `window.__SERVER_DATA__`, plus optional official-API price lookups), NYC Parks (live JSON feed), and key-gated Ticketmaster, SeatGeek and PredictHQ. Keys are Pages variables/secrets: `.dev.vars` locally (see `.dev.vars.example`), the dashboard's Variables and Secrets in production. Each function passes its `env` to `setEnv()` (`lib/env.ts`) and server code reads keys with `getEnv()`. A source without its key is skipped. Eventbrite and NYC Parks only run near NYC. Results are cached for 30 min per source in memory for the life of the isolate. City search in the forms calls Open-Meteo's geocoder straight from the browser (`lib/cities.ts`).

## Architecture notes

- **Path alias**: `@/*` maps to the repo root in both tsconfigs and in esbuild/Wrangler (e.g. `@/lib/times`, `@/web/dom`).
- `lib/`, `data/`, `constants/` and `types/` are shared by the browser app and the functions, so keep them free of DOM-only or server-only APIs (the scrapers and `lib/env.ts` are server-only).
- **Styling** is plain CSS in `web/styles.css` (bundled to `public/build/main.css`), BEM class names, dark theme. No Tailwind.
- **DOM**: `h()` in `web/dom.ts` builds elements; screens are functions returning elements (tab screens return `{ element, show, hide }` and stay mounted while hidden).
- **Icons**: Ionicons SVGs imported as text in `web/icons.ts` (via the `ionicons-svg` alias in `build.mjs`); PNG icons in `public/images/` are tinted with `tintedImage()`.
- **Cloudflare limits**: Pages Functions run on Workers. The Free plan allows 50 subrequests and 10 ms CPU per request; a full scrape can use ~40 fetches and more CPU than that, so the Workers Paid plan ($5/month) is recommended.
