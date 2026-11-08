import { type Coordinates, distanceMiles } from '@/lib/cities';
import { categoryForInterest, interestPattern } from '@/lib/categorize';
import { parseRanges, type Time } from '@/lib/times';
import type { EventItem } from '@/types/events';

// Events are shown in New York time, so availability is checked there too
const TIME_ZONE = 'America/New_York';
const MINUTES_PER_DAY = 24 * 60;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type RankingPreferences = {
  center: Coordinates;
  radiusMiles: number;
  // Saved preference strings, e.g. "Fri, Sat, Sun" and "6:00 PM - 10:00 PM; Sat, Sun: 1:00 PM - 3:00 PM"
  days: string;
  times: string;
  interests: string[];
  // End of the search window
  until: Date;
};

const zoneParts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
const zoneDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// Weekday ("Fri") and minutes since midnight of a moment, in New York time
function localTime(date: Date) {
  const parts = zoneParts.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = ({ hour, minute, period }: Time) => ((hour % 12) + (period === 'PM' ? 12 : 0)) * 60 + minute;

const splitDays = (days: string) =>
  days
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean);

type Slot = { days: string[]; start: number; end: number };

function availabilitySlots(days: string, times: string): Slot[] {
  // No days picked means no day restriction, rather than an empty feed
  const mainDays = splitDays(days).length ? splitDays(days) : WEEKDAYS;
  return parseRanges(times).map((range) => {
    const start = toMinutes(range.start);
    let end = toMinutes(range.end);
    // e.g. 9:00 PM - 2:00 AM runs past midnight
    if (end <= start) end += MINUTES_PER_DAY;
    return { days: range.days === undefined ? mainDays : splitDays(range.days), start, end };
  });
}

// True when any part of the event falls inside one of the user's free slots
function fitsAvailability(event: EventItem, slots: Slot[]) {
  const start = new Date(event.startAt);
  const { weekday, minutes } = localTime(start);
  const duration = Math.min((new Date(event.endAt).getTime() - start.getTime()) / 60000, MINUTES_PER_DAY);
  const previousDay = WEEKDAYS[(WEEKDAYS.indexOf(weekday) + 6) % 7];

  return slots.some(
    (slot) =>
      // Same day, or the tail of a slot that started the day before and runs past midnight
      (slot.days.includes(weekday) && minutes < slot.end && minutes + duration > slot.start) ||
      (slot.days.includes(previousDay) && minutes + MINUTES_PER_DAY < slot.end),
  );
}

// How well the event matches the user's interests: 1 for its category, 0.8 for a mention in the text, else 0
function interestScore(event: EventItem, interests: string[]) {
  const text = `${event.title}\n${event.description}`;
  let best = 0;
  for (const interest of interests) {
    if (categoryForInterest(interest) === event.category) return 1;
    if (interestPattern(interest).test(text)) best = 0.8;
  }
  return best;
}

// The same event is often listed on several sources. Keep the copy with the most details.
function dedupe(events: EventItem[]) {
  const detail = (event: EventItem) => (event.imageUrl ? 2 : 0) + (event.price !== null ? 1 : 0) + (event.description ? 1 : 0);
  const byKey = new Map<string, EventItem>();
  for (const event of events) {
    const key = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${zoneDate.format(new Date(event.startAt))}`;
    const existing = byKey.get(key);
    if (!existing || detail(event) > detail(existing)) byKey.set(key, event);
  }
  return [...byKey.values()];
}

// Drops events the user can't make (too far, past, outside their availability), then sorts the rest best-first
export function rankEvents(events: EventItem[], prefs: RankingPreferences, now = new Date()): EventItem[] {
  const slots = availabilitySlots(prefs.days, prefs.times);
  const windowMs = prefs.until.getTime() - now.getTime();

  return dedupe(events)
    .map((event) => ({ ...event, distanceMiles: Math.round(distanceMiles(prefs.center, event) * 10) / 10 }))
    .filter((event) => {
      const start = new Date(event.startAt);
      return start > now && start <= prefs.until && event.distanceMiles <= prefs.radiusMiles && fitsAvailability(event, slots);
    })
    .map((event) => {
      const soon = 1 - (new Date(event.startAt).getTime() - now.getTime()) / windowMs;
      const close = 1 - event.distanceMiles / prefs.radiusMiles;
      // Interest matters most; events that match nothing still show, just after the matches
      const score = interestScore(event, prefs.interests) * 100 + close * 30 + soon * 20 + (event.imageUrl ? 5 : 0);
      return { event, score };
    })
    .sort((a, b) => b.score - a.score)
    // The score goes along so the browser can adjust it for the user's own taste, age and gender (lib/personalize.ts)
    .map(({ event, score }) => ({ ...event, score: Math.round(score * 10) / 10 }));
}
