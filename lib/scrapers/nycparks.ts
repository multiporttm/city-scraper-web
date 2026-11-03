import { fetchJson, stripHtml, zonedToIso } from '@/lib/scrapers/http';
import type { RawEvent, Scraper } from '@/lib/scrapers/types';

// NYC Parks' own feed of public events for the next 14 days. (The NYC Open Data copy stopped updating in 2019.)
const FEED = 'https://www.nycgovparks.org/xml/events_300_rss.json';
const TIME_ZONE = 'America/New_York';

type ParksEvent = {
  guid: string;
  title: string;
  description: string;
  link: string;
  startdate: string;
  enddate: string;
  // e.g. "10:00 am"
  starttime: string;
  endtime: string;
  location: string | null;
  parknames: string | null;
  // "lat, lon", sometimes several pairs separated by ";"
  coordinates: string | null;
  // e.g. "Best for Kids | Volunteer"
  categories: string | null;
  image: string | null;
};

// "7:30 pm" → "19:30"
function to24Hour(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

// The feed links over http, which browsers block on an https page
const https = (url: string) => url.replace(/^http:/, 'https:');

function toRawEvent(event: ParksEvent): RawEvent | null {
  const start = to24Hour(event.starttime);
  const end = to24Hour(event.endtime);
  const [latitude, longitude] = (event.coordinates?.split(';')[0] ?? '').split(',').map(Number);
  if (!start || !latitude || !longitude) return null;
  return {
    source: 'nycparks',
    sourceId: event.guid,
    title: stripHtml(event.title),
    description: stripHtml(event.description),
    startAt: zonedToIso(event.startdate, start, TIME_ZONE),
    endAt: end ? zonedToIso(event.enddate, end, TIME_ZONE) : null,
    venue: stripHtml(event.location ?? event.parknames ?? ''),
    neighborhood: stripHtml(event.parknames ?? ''),
    latitude,
    longitude,
    imageUrl: event.image ? https(event.image) : null,
    // The feed doesn't list costs (most Parks events are free)
    price: null,
    url: https(event.link),
    host: 'NYC Parks',
    sourceCategories: (event.categories ?? '').split('|').map((category) => category.trim()),
  };
}

export const fetchNycParks: Scraper = async () => {
  const events = await fetchJson<ParksEvent[]>(FEED);
  return events.filter((event) => !event.categories?.includes('Virtual/Online')).flatMap((event) => toRawEvent(event) ?? []);
};
