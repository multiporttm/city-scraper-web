import type { EventItem } from '@/types/events';

// Events are shown in New York time, the same zone the server ranks availability in
const TIME_ZONE = 'America/New_York';

const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });

// e.g. "Fri, Oct 30 · 7:00 - 9:00 PM", or "11:30 PM - 1:30 AM" when the period changes
export function formatWhen(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TIME_ZONE });
  const startTime = formatTime(start);
  const endTime = formatTime(new Date(endAt));
  const samePeriod = startTime.slice(-2) === endTime.slice(-2);
  return `${day} · ${samePeriod ? startTime.slice(0, -3) : startTime} - ${endTime}`;
}

// null means the source didn't list a price
export const formatPrice = (price: number | null) => (price === null ? 'See tickets' : price === 0 ? 'Free' : `$${price}`);

// e.g. "Elsewhere · Brooklyn", skipping whichever part the source left blank
export const formatPlace = (event: EventItem) => [event.venue, event.neighborhood].filter(Boolean).join(' · ');

const MIN_TILT_DEG = 1;
const MAX_TILT_DEG = 3;

// Random-looking but stable tilt per event, so a card keeps its angle when it moves to the top of the stack.
export function tiltFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // Mix the bits so similar ids don't land on nearly the same angle
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash ^= hash >>> 16;
  const magnitude = MIN_TILT_DEG + (((hash >>> 0) % 1000) / 1000) * (MAX_TILT_DEG - MIN_TILT_DEG);
  return (hash >>> 20) % 2 === 0 ? magnitude : -magnitude;
}
