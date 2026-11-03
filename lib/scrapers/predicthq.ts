import { getEnv } from '@/lib/env';
import { fetchJson } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// PredictHQ Events API: https://docs.predicthq.com. A paid aggregator (with a free trial) covering many public events.
const API = 'https://api.predicthq.com/v1/events/';
const PAGE_SIZE = 100;
// Only categories people can attend; the API also has holidays, weather, outages and so on
const CATEGORIES = 'concerts,performing-arts,community,expos,festivals,sports,conferences';

type PredictHqEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  labels: string[];
  start: string;
  end: string | null;
  // [longitude, latitude]
  location: [number, number];
  geo?: { address?: { locality?: string } };
  entities: { name: string; type: string }[];
};

type PredictHqPage = { results: PredictHqEvent[] };

const day = (date: Date) => date.toISOString().slice(0, 10);

function toRawEvent(event: PredictHqEvent): RawEvent {
  const venue = event.entities.find((entity) => entity.type === 'venue')?.name ?? '';
  const [longitude, latitude] = event.location;
  return {
    source: 'predicthq',
    sourceId: event.id,
    title: event.title,
    description: event.description,
    startAt: event.start,
    // PredictHQ sets end = start when it doesn't know the end
    endAt: event.end && event.end !== event.start ? event.end : null,
    venue,
    neighborhood: event.geo?.address?.locality ?? '',
    latitude,
    longitude,
    // PredictHQ has no images, ticket links or prices
    imageUrl: null,
    price: null,
    url: `https://www.google.com/search?${new URLSearchParams({ q: [event.title, venue].filter(Boolean).join(' ') })}`,
    host: venue,
    sourceCategories: [event.category, ...event.labels].map((label) => label.replace(/[-_]/g, ' ')),
  };
}

export const fetchPredictHq: Scraper = async ({ latitude, longitude, radiusMiles, from, to }) => {
  // Server-only secret
  const token = getEnv('PREDICTHQ_TOKEN');
  if (!token) throw new Error('PREDICTHQ_TOKEN is not set');

  const params = new URLSearchParams({
    within: `${Math.ceil(radiusMiles)}mi@${latitude},${longitude}`,
    'active.gte': day(from),
    'active.lte': day(to),
    category: CATEGORIES,
    state: 'active',
    sort: 'start',
    limit: String(PAGE_SIZE),
  });
  const data = await fetchJson<PredictHqPage>(`${API}?${params}`, { Authorization: `Bearer ${token}` });
  return data.results.map(toRawEvent);
};
