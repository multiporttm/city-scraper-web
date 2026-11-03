import { getEnv } from '@/lib/env';
import { distanceMiles } from '@/lib/cities';
import { fetchEventbrite } from '@/lib/scrapers/eventbrite';
import { fetchLuma } from '@/lib/scrapers/luma';
import { fetchMeetup } from '@/lib/scrapers/meetup';
import { normalize } from '@/lib/scrapers/normalize';
import { fetchNycParks } from '@/lib/scrapers/nycparks';
import { fetchPredictHq } from '@/lib/scrapers/predicthq';
import { fetchSeatGeek } from '@/lib/scrapers/seatgeek';
import { fetchTicketmaster } from '@/lib/scrapers/ticketmaster';
import type { Scraper, SourceQuery } from '@/lib/scrapers/types';
import type { EventItem, EventSource } from '@/types/events';

// `skipped` is set when a source is off because its API key isn't configured
export type SourceStatus = { source: EventSource; ok: boolean; count: number; error?: string; skipped?: boolean };

const CACHE_MS = 30 * 60 * 1000;
// Eventbrite and NYC Parks only have New York data, so they only help near NYC
const NYC = { latitude: 40.7128, longitude: -74.006 };
const NYC_RANGE_MILES = 40;

type Source = {
  source: EventSource;
  scrape: Scraper;
  nycOnly: boolean;
  // Secret the source needs (.dev.vars locally, Pages dashboard → Variables and Secrets in production); skipped without it
  requiresEnv?: string;
  // Requests with the same key share one cached result
  cacheKey: (query: SourceQuery) => string;
};

const interestKey = ({ interests }: SourceQuery) => interests.slice(0, 5).join('|').toLowerCase();
const areaKey = ({ latitude, longitude, radiusMiles }: SourceQuery) => `${latitude.toFixed(2)},${longitude.toFixed(2)},${radiusMiles}`;

const SOURCES: Source[] = [
  { source: 'luma', scrape: fetchLuma, nycOnly: false, cacheKey: areaKey },
  { source: 'meetup', scrape: fetchMeetup, nycOnly: false, cacheKey: (query) => `${areaKey(query)}|${interestKey(query)}` },
  { source: 'eventbrite', scrape: fetchEventbrite, nycOnly: true, cacheKey: interestKey },
  { source: 'nycparks', scrape: fetchNycParks, nycOnly: true, cacheKey: () => 'nyc' },
  { source: 'ticketmaster', scrape: fetchTicketmaster, nycOnly: false, requiresEnv: 'TICKETMASTER_API_KEY', cacheKey: areaKey },
  { source: 'seatgeek', scrape: fetchSeatGeek, nycOnly: false, requiresEnv: 'SEATGEEK_CLIENT_ID', cacheKey: areaKey },
  { source: 'predicthq', scrape: fetchPredictHq, nycOnly: false, requiresEnv: 'PREDICTHQ_TOKEN', cacheKey: areaKey },
];

type CacheEntry = { at: number; events: Promise<EventItem[]> };

// Keeps the promise, so requests that arrive while a scrape is running wait for it instead of scraping again.
// Lives as long as the Cloudflare isolate running the function, so warm requests in the same location reuse it.
const store = globalThis as typeof globalThis & { __eventsCache?: Map<string, CacheEntry> };
const cache = (store.__eventsCache ??= new Map());

function scrapeCached({ source, scrape, cacheKey }: Source, query: SourceQuery) {
  const key = `${source}:${cacheKey(query)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.events;

  const events = scrape(query).then((raw) => raw.flatMap((event) => normalize(event) ?? []));
  cache.set(key, { at: Date.now(), events });
  // Don't keep failures around; the next request retries
  events.catch(() => cache.delete(key));
  return events;
}

// Runs every source at once. A broken source is reported in the statuses but doesn't stop the others.
export async function scrapeEvents(query: SourceQuery) {
  const nearNyc = distanceMiles(query, NYC) <= NYC_RANGE_MILES;
  const nearby = SOURCES.filter((source) => nearNyc || !source.nycOnly);
  const missingKey = (source: Source) => !!source.requiresEnv && !getEnv(source.requiresEnv);
  const sources = nearby.filter((source) => !missingKey(source));
  const results = await Promise.allSettled(sources.map((source) => scrapeCached(source, query)));

  const statuses: SourceStatus[] = sources.map(({ source }, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') return { source, ok: true, count: result.value.length };
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.warn(`[events] ${source} failed: ${error}`);
    return { source, ok: false, count: 0, error };
  });
  for (const source of nearby.filter(missingKey)) {
    statuses.push({ source: source.source, ok: false, count: 0, skipped: true, error: `Set ${source.requiresEnv} to turn this source on` });
  }
  const events = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  return { events, statuses };
}
