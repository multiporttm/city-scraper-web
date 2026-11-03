# City Scraper

Event exploration and management tool. Scrapes event-hosting websites like Luma, EventBrite, and Ticketmaster's public APIs to suggest events for users based on their inputted location, availability throughout the week, location, and range of commutable distance.


## Screenshots

Recommended events are displayed with their location on a map, with an event card containing basic information. Tapping on the card centralizes the user's view of the event on the map, and tapping again opens an expanded modal with more event information and a link to the external listing. Dragging the card left (or pressing ←) archives the event, dragging right (or →) saves it.

<div>
<img src="screenshots/functionality/loading.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/functionality/card.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/functionality/expanded.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/functionality/pinned.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
</div>
<br>

On signing in, users enter basic information and their preferences for events, they can return to their settings page to edit this information. Editing preferences will reload the recommendations, but keep pinned events safe.>

<div>
<img src="screenshots/settings/settings.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/settings/location.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/settings/availability.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">
<img src="screenshots/settings/interests.png" width="140.333" height="286.33" alt="Part of failing the cooking sequence">

</div>
<br>



## Run it locally

Needs Node 20+.

```sh
npm install
cp .dev.vars.example .dev.vars   # optional: API keys for Ticketmaster, SeatGeek, PredictHQ, Eventbrite prices
npm run dev                      # http://localhost:8787
```

The site is plain HTML, CSS and TypeScript (`public/`, `web/`), bundled with esbuild. The Cloudflare Worker in `worker/` serves `GET /api/events`, which scrapes the sources in `lib/scrapers/` and ranks the results for the user's preferences.

## Deploy to Cloudflare

```sh
npx wrangler login
npm run deploy                                  # builds, uploads public/ as static assets and deploys the Worker
npx wrangler secret put TICKETMASTER_API_KEY    # repeat for any keys in .dev.vars.example you want on
```

The app is then live at `https://city-scraper.<your-subdomain>.workers.dev` (add a custom domain in the Cloudflare dashboard). You can also connect the GitHub repo in **Workers & Pages → Create → Import a repository** with build command `npm run build` and deploy command `npx wrangler deploy`.

Notes:

- **Use the Workers Paid plan ($5/month) for reliable results.** A full scrape makes about 40 outbound requests and parses a few thousand events. The Free plan caps each request at 50 subrequests and 10 ms of CPU, so requests can be cut short. Turning on `EVENTBRITE_TOKEN` adds up to 60 more requests.
- Results are cached in memory for 30 minutes per source, per Worker instance.
- **Apple Maps** draws the Explore map once its keys are set (otherwise the map falls back to OpenStreetMap):
  1. In your Apple Developer account ([Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)), create a **Maps ID**, then a **key** with **MapKit JS** enabled for it, and download the `.p8` file.
  2. Set the secrets: `npx wrangler secret put APPLE_MAPKIT_TEAM_ID` (your Team ID), `APPLE_MAPKIT_KEY_ID` (the key's ID), and `APPLE_MAPKIT_PRIVATE_KEY` (paste the whole `.p8` file). For local dev, put them in `.dev.vars`.
  3. The Worker signs a 30-minute token for each visitor at `/api/mapkit-token`, locked to your site's origin; the private key never reaches the browser.
- The fallback OpenStreetMap tiles are fine for light use. For real traffic without Apple Maps, switch `TILES` in `web/components/leafletMap.ts` to a hosted tile provider.
- Sign-in is a local stand-in: the name, preferences and pinned events are kept in the browser's localStorage.
