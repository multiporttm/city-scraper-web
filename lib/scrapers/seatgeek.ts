import { getEnv } from '@/lib/env';
import { fetchJson, stripHtml } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// SeatGeek Platform API: https://platform.seatgeek.com. Concerts, sports, theater and comedy with ticket prices.
const API = 'https://api.seatgeek.com/2/events';
const PAGE_SIZE = 100;
const MAX_PAGES = 2;

type SeatGeekEvent = {
  id: number;
  title: string;
  url: string;
  description?: string;
  // UTC, but without a "Z", e.g. 2026-10-30T23:30:00
  datetime_utc: string;
  enddatetime_utc: string | null;
  time_tbd: boolean;
  type: string;
  taxonomies: { name: string }[];
  performers: { name: string; image: string | null }[];
  venue: { name: string; city: string; location: { lat: number; lon: number } };
  stats: { lowest_price: number | null };
};

type SeatGeekPage = { events: SeatGeekEvent[]; meta: { total: number; page: number; per_page: number } };

// SeatGeek wants UTC without a zone suffix
const apiDate = (date: Date) => date.toISOString().slice(0, 19);

function toRawEvent(event: SeatGeekEvent): RawEvent {
  return {
    source: 'seatgeek',
    sourceId: String(event.id),
    title: event.title,
    description: stripHtml(event.description ?? ''),
    startAt: `${event.datetime_utc}Z`,
    endAt: event.enddatetime_utc ? `${event.enddatetime_utc}Z` : null,
    venue: event.venue.name,
    neighborhood: event.venue.city,
    latitude: event.venue.location.lat,
    longitude: event.venue.location.lon,
    imageUrl: event.performers.find((performer) => performer.image)?.image ?? null,
    price: event.stats.lowest_price,
    url: event.url,
    host: event.performers[0]?.name ?? event.venue.name,
    sourceCategories: [event.type, ...event.taxonomies.map((taxonomy) => taxonomy.name)].map((name) => name.replace(/_/g, ' ')),
  };
}

export const fetchSeatGeek: Scraper = async ({ latitude, longitude, radiusMiles, from, to }) => {
  // Server-only secret, like the Ticketmaster key
  const clientId = getEnv('SEATGEEK_CLIENT_ID');
  if (!clientId) throw new Error('SEATGEEK_CLIENT_ID is not set');

  const events: RawEvent[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      client_id: clientId,
      lat: String(latitude),
      lon: String(longitude),
      range: `${Math.ceil(radiusMiles)}mi`,
      'datetime_utc.gte': apiDate(from),
      'datetime_utc.lte': apiDate(to),
      per_page: String(PAGE_SIZE),
      page: String(page),
      sort: 'datetime_utc.asc',
    });
    const data = await fetchJson<SeatGeekPage>(`${API}?${params}`);
    // Events with no set time yet would show up as midnight
    events.push(...data.events.filter((event) => !event.time_tbd).map(toRawEvent));
    if (page * PAGE_SIZE >= data.meta.total) break;
  }
  return events;
};
