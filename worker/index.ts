import { geocodeCity, type Coordinates } from '@/lib/cities';
import { rankEvents } from '@/lib/ranking';
import { scrapeEvents } from '@/lib/scrapers';

// How far ahead the feed looks
const WINDOW_DAYS = 14;
const DEFAULT_DISTANCE_MILES = 5;

// Saved locations rarely change, so remember their coordinates for as long as the isolate lives
const locations = new Map<string, Coordinates | null>();

async function locate(location: string) {
  if (!locations.has(location)) locations.set(location, await geocodeCity(location));
  return locations.get(location) ?? null;
}

// GET /api/events?location=&distance=&days=&times=&interests=
// Takes the saved preference strings as they are, scrapes every source and returns the events that fit, best first.
async function getEvents(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = params.get('location')?.trim() ?? '';
  const center = location ? await locate(location) : null;
  if (!center) return Response.json({ error: `Couldn't find "${location}". Try a different city.` }, { status: 400 });

  const distance = Number(params.get('distance'));
  const radiusMiles = distance > 0 ? distance : DEFAULT_DISTANCE_MILES;
  const interests = (params.get('interests') ?? '')
    .split(',')
    .map((interest) => interest.trim())
    .filter(Boolean);
  const from = new Date();
  const to = new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { events, statuses } = await scrapeEvents({ ...center, radiusMiles, interests, from, to });
  const ranked = rankEvents(events, {
    center,
    radiusMiles,
    days: params.get('days') ?? '',
    times: params.get('times') ?? '',
    interests,
    until: to,
  });

  return Response.json({ events: ranked, sources: statuses });
}

// Static files (public/) are served before the Worker runs; only /api/* gets here (see run_worker_first in wrangler.jsonc).
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/events') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
      return getEvents(request);
    }
    if (pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
