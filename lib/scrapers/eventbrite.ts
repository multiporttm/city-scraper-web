import { getEnv } from '@/lib/env';
import { extractWindowJson, fetchJson, fetchText, mapLimited, stripHtml, zonedToIso } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// Eventbrite's NYC search pages, e.g. /d/ny--new-york/running/. One generic page plus one per interest.
const SEARCH_PAGE = 'https://www.eventbrite.com/d/ny--new-york';
const MAX_INTEREST_PAGES = 5;
const API = 'https://www.eventbriteapi.com/v3';
// The API allows 1,000 calls an hour per token, and results are cached for 30 minutes
const MAX_PRICED_EVENTS = 60;
const PRICE_CONCURRENCY = 5;

type EventbriteEvent = {
  id: string;
  name: string;
  summary: string | null;
  start_date: string;
  start_time: string;
  end_date: string | null;
  end_time: string | null;
  timezone: string;
  url: string;
  is_online_event: boolean;
  is_cancelled?: boolean;
  image: { url: string; original?: { url: string } } | null;
  tags: { display_name: string }[] | null;
  primary_organizer: { name: string } | null;
  primary_venue: {
    name: string;
    address: { city?: string; latitude?: string; longitude?: string; localized_area_display?: string };
  } | null;
};

// Search pages put results in search_data; the generic city page groups them into buckets
type ServerData = {
  search_data?: { events: { results: EventbriteEvent[] } };
  buckets?: { events?: EventbriteEvent[] }[];
};

// Coordinates come as strings; missing or blank ones become null
const toCoordinate = (value: string | undefined) => (value ? Number(value) : null);

function toRawEvent(event: EventbriteEvent): RawEvent {
  const venue = event.primary_venue;
  return {
    source: 'eventbrite',
    sourceId: event.id,
    title: event.name,
    description: stripHtml(event.summary ?? ''),
    startAt: zonedToIso(event.start_date, event.start_time, event.timezone),
    endAt: event.end_date && event.end_time ? zonedToIso(event.end_date, event.end_time, event.timezone) : null,
    venue: venue?.name ?? '',
    neighborhood: venue?.address.city ?? '',
    latitude: toCoordinate(venue?.address.latitude),
    longitude: toCoordinate(venue?.address.longitude),
    imageUrl: event.image?.original?.url ?? event.image?.url ?? null,
    // Search results don't include ticket prices; addPrices fills them in when there's an API token
    price: null,
    url: event.url,
    host: event.primary_organizer?.name ?? venue?.name ?? '',
    sourceCategories: (event.tags ?? []).map((tag) => tag.display_name),
  };
}

const slugFor = (interest: string) =>
  interest
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function fetchPage(path: string) {
  const data = extractWindowJson<ServerData>(await fetchText(`${SEARCH_PAGE}/${path}/`), '__SERVER_DATA__');
  if (!data) throw new Error('Eventbrite page no longer has __SERVER_DATA__');
  return data.search_data?.events.results ?? (data.buckets ?? []).flatMap((bucket) => bucket.events ?? []);
}

type TicketAvailability = {
  ticket_availability: { is_free: boolean; minimum_ticket_price: { major_value: string } | null } | null;
};

// Eventbrite's official API dropped public event search in 2020, but it still returns details for a known event id.
// With a private token (eventbrite.com/platform/api-keys) it fills in the ticket prices the search pages leave out.
async function addPrices(events: RawEvent[]) {
  const token = getEnv('EVENTBRITE_TOKEN');
  if (!token) return events;
  const priced = events.slice(0, MAX_PRICED_EVENTS);
  const results = await mapLimited(priced, PRICE_CONCURRENCY, (event) =>
    fetchJson<TicketAvailability>(`${API}/events/${event.sourceId}/?expand=ticket_availability`, { Authorization: `Bearer ${token}` }),
  );
  results.forEach((result, i) => {
    const tickets = result.status === 'fulfilled' ? result.value.ticket_availability : null;
    if (tickets) priced[i].price = tickets.is_free ? 0 : Number(tickets.minimum_ticket_price?.major_value ?? NaN) || null;
  });
  return events;
}

export const fetchEventbrite: Scraper = async ({ interests }) => {
  const paths = ['events', ...interests.slice(0, MAX_INTEREST_PAGES).map(slugFor)];
  const pages = await Promise.allSettled(paths.map(fetchPage));
  const found = pages.flatMap((page) => (page.status === 'fulfilled' ? page.value : []));
  // Every page failing means the scraper is broken, not that there are no events
  if (found.length === 0 && pages.every((page) => page.status === 'rejected')) throw (pages[0] as PromiseRejectedResult).reason;

  // Interest pages overlap, so drop repeats before asking the API about each one
  const unique = [...new Map(found.map((event) => [event.id, event])).values()];
  return addPrices(unique.filter((event) => !event.is_online_event && !event.is_cancelled).map(toRawEvent));
};
