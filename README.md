# City Scraper

Event exploration and management tool. Scrapes event-hosting websites like Luma, EventBrite, and Ticketmaster's public APIs to suggest events for users based on their inputted location, availability throughout the week, location, and range of commutable distance.

**Try it:** https://city-scraper-web.pages.dev


## Screenshots

Recommended events are displayed with their location on a map, with an event card containing basic information. Tapping on the card centers the map on the event, and tapping again opens an expanded sheet with more event information and a link to the external listing. Dragging the card left (or pressing ←) archives the event, dragging right (or →) saves it.

<div>
<img src="screenshots/functionality/loading.png" width="140" height="303" alt="Explore loading events over the dark map">
<img src="screenshots/functionality/card.png" width="140" height="303" alt="Explore with event pins on the map and the event card stack">
<img src="screenshots/functionality/expanded.png" width="140" height="303" alt="Expanded event details with Archive and Pin buttons">
<img src="screenshots/functionality/pinned.png" width="140" height="303" alt="Pinned events list">
</div>
<br>

On signing in, users enter basic information and their preferences for events, they can return to their settings page to edit this information. Editing preferences will reload the recommendations, but keep pinned events safe.

<div>
<img src="screenshots/settings/settings.png" width="140" height="303" alt="Settings screen">
<img src="screenshots/settings/location.png" width="140" height="303" alt="Location and distance sheet">
<img src="screenshots/settings/availability.png" width="140" height="303" alt="Availability sheet with two timeslots">
<img src="screenshots/settings/interests.png" width="140" height="303" alt="Interests sheet with suggested interests">

</div>
<br>



## Run it locally

Needs Node 20+.

```sh
npm install
cp .dev.vars.example .dev.vars   # optional: API keys for Ticketmaster, SeatGeek, PredictHQ, Eventbrite prices, Apple Maps
npm run dev                      # http://localhost:8788 (Cloudflare Pages, run locally)
```

The site is plain HTML, CSS and TypeScript (`public/`, `web/`), bundled with esbuild into `public/build/`. The API runs as Cloudflare Pages Functions in `functions/api/`: `GET /api/events` scrapes the sources in `lib/scrapers/` and ranks the results for the user's preferences. Run `npm run watch` in a second terminal to rebuild the browser app as you edit.

## Deploy on Cloudflare Pages (dashboard)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `public`
   - **Production branch:** the branch you deploy from (e.g. `main`)
3. **Save and Deploy.** The site is live at `https://<project>.pages.dev`, and every push to the branch redeploys it.
4. Optional keys: your project → **Settings → Variables and Secrets → Add**, using the names in `.dev.vars.example` (e.g. `TICKETMASTER_API_KEY`). Add them as **Secret** for Production (and Preview if you want). Then redeploy (**Deployments → … → Retry deployment**) so they take effect.

`wrangler.jsonc` holds the Pages settings (output folder, compatibility date and the `nodejs_compat` flag), so those show as read-only in the dashboard. You can also deploy from your computer with `npx wrangler login` then `npm run deploy`.

Notes:

- **Use the Workers Paid plan ($5/month) for reliable results.** Pages Functions run on Workers and share its limits. A full scrape makes about 40 outbound requests and parses a few thousand events; the Free plan caps each request at 50 subrequests and 10 ms of CPU, so requests can be cut short. (Upgrade under **Workers & Pages → Plans**.) Turning on `EVENTBRITE_TOKEN` adds up to 60 more requests.
- Results are cached in memory for 30 minutes per source, per running instance.
- **Apple Maps** draws the Explore map once its keys are set (otherwise it uses the free OpenFreeMap map below):
  1. In your Apple Developer account ([Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)), create a **Maps ID**, then a **key** with **MapKit JS** enabled for it, and download the `.p8` file.
  2. In the Pages project's **Variables and Secrets**, add `APPLE_MAPKIT_TEAM_ID` (your Team ID), `APPLE_MAPKIT_KEY_ID` (the key's ID), and `APPLE_MAPKIT_PRIVATE_KEY` (paste the whole `.p8` file) as secrets. For local dev, put them in `.dev.vars`.
  3. The site's function signs a 30-minute token for each visitor at `/api/mapkit-token`, locked to your site's origin; the private key never reaches the browser.
- Without Apple keys, the map uses free data from [OpenFreeMap](https://openfreemap.org) (OpenStreetMap, drawn with MapLibre), styled to look like Apple Maps' dark mode: no key, sign-up or view limit. The colors live in `web/components/mapStyle.ts`. Map labels use the LandUI Pro font, pre-cut into glyph files in `public/fonts/`; to change the font, follow the steps at the top of `scripts/build-map-glyphs.mjs`.
- Sign-in is a local stand-in: the name, preferences and pinned events are kept in the browser's localStorage.
