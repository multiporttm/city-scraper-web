import { getEnv } from '@/lib/env';
import { fetchJson, stripHtml, zonedToIso } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// Official Discovery API: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
const API = 'https://app.ticketmaster.com/discovery/v2/events.json';
const PAGE_SIZE = 100;
const MAX_PAGES = 2;

type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  info?: string;
  description?: string;
  images?: { url: string; ratio?: string; width: number }[];
  dates: {
    start: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string };
    timezone?: string;
    status?: { code?: string };
  };
  priceRanges?: { min: number }[];
  promoter?: { name: string };
  classifications?: { segment?: { name: string }; genre?: { name: string }; subGenre?: { name: string } }[];
  _embedded?: {
    venues?: {
      name: string;
      city?: { name: string };
      location?: { latitude: string; longitude: string };
    }[];
    attractions?: { name: string }[];
  };
};

type TicketmasterPage = { _embedded?: { events: TicketmasterEvent[] }; page: { totalPages: number } };

// The API wants UTC without milliseconds, e.g. 2026-10-26T00:00:00Z
const apiDate = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

function startOf({ dates }: TicketmasterEvent) {
  if (dates.start.dateTime) return dates.start.dateTime;
  // Some events only list a local date and time
  if (dates.start.localDate) return zonedToIso(dates.start.localDate, dates.start.localTime ?? '19:00', dates.timezone ?? 'America/New_York');
  return null;
}

function toRawEvent(event: TicketmasterEvent, startAt: string): RawEvent {
  const venue = event._embedded?.venues?.[0];
  // Widest 16:9 image looks best in the cards
  const image = [...(event.images ?? [])].filter((img) => img.ratio === '16_9').sort((a, b) => b.width - a.width)[0] ?? event.images?.[0];
  const classification = event.classifications?.[0];
  return {
    source: 'ticketmaster',
    sourceId: event.id,
    title: event.name,
    description: stripHtml(event.description ?? event.info ?? ''),
    startAt,
    endAt: event.dates.end?.dateTime ?? null,
    venue: venue?.name ?? '',
    neighborhood: venue?.city?.name ?? '',
    latitude: venue?.location ? Number(venue.location.latitude) : null,
    longitude: venue?.location ? Number(venue.location.longitude) : null,
    imageUrl: image?.url ?? null,
    price: event.priceRanges?.[0]?.min ?? null,
    url: event.url,
    host: event._embedded?.attractions?.[0]?.name ?? event.promoter?.name ?? venue?.name ?? '',
    sourceCategories: [classification?.segment?.name, classification?.genre?.name, classification?.subGenre?.name].filter(
      (name): name is string => !!name && name !== 'Undefined',
    ),
  };
}

export const fetchTicketmaster: Scraper = async ({ latitude, longitude, radiusMiles, from, to }) => {
  // Server-side secret, never sent to the browser
  const apiKey = getEnv('TICKETMASTER_API_KEY');
  if (!apiKey) throw new Error('TICKETMASTER_API_KEY is not set');

  const events: RawEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      apikey: apiKey,
      latlong: `${latitude},${longitude}`,
      radius: String(Math.ceil(radiusMiles)),
      unit: 'miles',
      startDateTime: apiDate(from),
      endDateTime: apiDate(to),
      size: String(PAGE_SIZE),
      page: String(page),
      sort: 'date,asc',
    });
    const data = await fetchJson<TicketmasterPage>(`${API}?${params}`);
    for (const event of data._embedded?.events ?? []) {
      const startAt = startOf(event);
      if (startAt && event.dates.status?.code !== 'cancelled') events.push(toRawEvent(event, startAt));
    }
    if (page + 1 >= data.page.totalPages) break;
  }
  return events;
};
