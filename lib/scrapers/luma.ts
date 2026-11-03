import { fetchJson } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// The API behind lu.ma's discovery pages. Given coordinates, it returns upcoming public events nearby, in date order.
// (Luma's official API only manages calendars you own, so it can't be used for discovery.)
const API = 'https://api.lu.ma/discover/get-paginated-events';
// Luma caps pages at about 50 events, and a busy city has 50+ a day, so covering two weeks takes many pages
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

type LumaEntry = {
  api_id: string;
  event: {
    name: string;
    start_at: string;
    end_at: string | null;
    cover_url: string | null;
    url: string;
    location_type: string;
    coordinate: { latitude: number; longitude: number } | null;
    geo_address_info: { address?: string; sublocality?: string; city?: string } | null;
  };
  calendar: { name?: string; description_short?: string | null } | null;
  hosts: { name: string }[] | null;
  ticket_info: { is_free: boolean; price: { cents: number } | null } | null;
};

type LumaPage = { entries: LumaEntry[]; has_more: boolean; next_cursor?: string };

function toRawEvent({ api_id, event, calendar, hosts, ticket_info }: LumaEntry): RawEvent {
  const address = event.geo_address_info;
  const hostNames = (hosts ?? []).map((host) => host.name).filter(Boolean);
  return {
    source: 'luma',
    sourceId: api_id,
    title: event.name,
    // The list API has no event description, so fall back to the hosting calendar's blurb
    description: calendar?.description_short ?? '',
    startAt: event.start_at,
    endAt: event.end_at,
    venue: address?.address ?? calendar?.name ?? 'Location shared after RSVP',
    neighborhood: address?.sublocality ?? address?.city ?? '',
    latitude: event.coordinate?.latitude ?? null,
    longitude: event.coordinate?.longitude ?? null,
    imageUrl: event.cover_url,
    price: ticket_info?.is_free ? 0 : ticket_info?.price ? ticket_info.price.cents / 100 : null,
    url: `https://lu.ma/${event.url}`,
    host: calendar?.name || hostNames.slice(0, 2).join(' & '),
    sourceCategories: [],
  };
}

export const fetchLuma: Scraper = async ({ latitude, longitude, to }) => {
  const events: RawEvent[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      pagination_limit: String(PAGE_SIZE),
    });
    if (cursor) params.set('pagination_cursor', cursor);
    let data: LumaPage;
    try {
      data = await fetchJson<LumaPage>(`${API}?${params}`);
    } catch (error) {
      // Keep the pages already fetched, e.g. when the Workers subrequest cap (50 per request on the Free plan) cuts the paging short
      if (page === 0) throw error;
      console.warn(`[events] luma stopped after ${page} pages: ${error instanceof Error ? error.message : error}`);
      break;
    }

    for (const entry of data.entries) {
      if (entry.event.location_type === 'offline') events.push(toRawEvent(entry));
    }
    // Results come in date order, so stop once we're past the window
    const last = data.entries.at(-1);
    if (!data.has_more || !data.next_cursor || (last && new Date(last.event.start_at) > to)) break;
    cursor = data.next_cursor;
  }
  return events;
};
