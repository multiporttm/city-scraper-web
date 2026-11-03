# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the full project rules (product overview, tech stack, UI quality bar, quiz flow). Read it before building a feature. The essentials are summarized below.

## Commands

- `npm run dev` — builds the browser app and runs the site + Worker locally with `wrangler dev` (http://localhost:8787); rebuilds on changes
- `npm run build` — bundles `web/` into `public/build/` with esbuild (`build.mjs`)
- `npm run typecheck` — `tsc` for the browser app (`tsconfig.json`) and the Worker (`worker/tsconfig.json`), strict mode
- `npm run deploy` — builds and deploys to Cloudflare (`wrangler deploy`)
- There is no test runner or linter configured yet.

## Current state

A plain HTML/CSS/TypeScript single-page app (no UI framework) served by Cloudflare Workers. It was converted from an Expo / React Native app; the screens, behaviour and look are the same.

- `public/index.html` is the only page. `web/main.ts` routes by pathname (`/sign-in`, `/quiz`, `/`, `/pinned`, `/settings`); `wrangler.jsonc` sets `not_found_handling: single-page-application` so every path gets `index.html`.
- State lives in small persisted stores (`web/store.ts`, localStorage), defined in `web/state.ts` (auth, profile, preferences, pinned/archived events). Sign-in is a local stand-in (just a first name).
- `web/feed.ts` fetches `/api/events` with the saved preferences and refetches when they change.
- Explore (`web/screens/explore.ts`) is a Leaflet map (OpenStreetMap tiles darkened with a CSS filter) under a stack of tilted cards. Drag/swipe right pins, left archives (`web/components/swipe.ts`); arrow keys do the same on desktop.

Events are scraped on demand by the Worker (`worker/index.ts`, `GET /api/events?location=&distance=&days=&times=&interests=`, the raw preference strings). It calls `lib/scrapers/` (one adapter per source), normalizes to `EventItem` (`lib/scrapers/normalize.ts`, categories from `lib/categorize.ts`), then filters and ranks by distance/availability/interests (`lib/ranking.ts`). Sources: Luma (its internal discover API, by coordinates), Meetup (GraphQL `api.meetup.com/gql-ext`), Eventbrite (NYC search pages' `window.__SERVER_DATA__`, plus optional official-API price lookups), NYC Parks (live JSON feed), and key-gated Ticketmaster, SeatGeek and PredictHQ. Keys are Worker secrets: `.dev.vars` locally (see `.dev.vars.example`), `wrangler secret put` in production; the `nodejs_compat` flag exposes them on `process.env`. A source without its key is skipped. Eventbrite and NYC Parks only run near NYC. Results are cached for 30 min per source in memory for the life of the Worker isolate. City search in the forms calls Open-Meteo's geocoder straight from the browser (`lib/cities.ts`).

## Architecture notes

- **Path alias**: `@/*` maps to the repo root in both tsconfigs and in esbuild/Wrangler (e.g. `@/lib/times`, `@/web/dom`).
- `lib/`, `data/`, `constants/` and `types/` are shared by the browser app and the Worker, so keep them free of DOM-only or Worker-only APIs (the scrapers are Worker-only).
- **Styling** is plain CSS in `web/styles.css` (bundled to `public/build/main.css`), BEM class names, dark theme. No Tailwind.
- **DOM**: `h()` in `web/dom.ts` builds elements; screens are functions returning elements (tab screens return `{ element, show, hide }` and stay mounted while hidden).
- **Icons**: Ionicons SVGs imported as text in `web/icons.ts` (via the `ionicons-svg` alias in `build.mjs`); PNG icons in `public/images/` are tinted with `tintedImage()`.
- **Cloudflare limits**: the Free plan allows 50 subrequests and 10 ms CPU per request; a full scrape can use ~40 fetches and more CPU than that, so the Workers Paid plan is recommended (see README).
