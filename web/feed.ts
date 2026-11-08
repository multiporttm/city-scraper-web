import { personalize } from '@/lib/personalize';
import { createStore } from '@/web/store';
import { preferences, profile, taste } from '@/web/state';
import type { EventItem } from '@/types/events';

type FeedState = {
  events: EventItem[];
  loading: boolean;
  error: string | null;
};

type EventsResponse = { events: EventItem[] } | { error: string };

// The ranked feed from /api/events for the saved preferences, re-ranked in the browser for the user's taste,
// age and gender. Lives outside the screens, so switching tabs doesn't refetch.
export const feed = createStore<FeedState>({ events: [], loading: false, error: null });

// The server's ranking, kept so the feed can be re-personalized without fetching again
let serverEvents: EventItem[] = [];
let lastQuery: string | null = null;
let controller: AbortController | null = null;

// Taste is read when the feed loads rather than after every swipe, so the card stack doesn't reshuffle mid-browse;
// what the user pins and archives shapes the next load.
const personalized = () => {
  const { age, gender } = profile.get();
  return personalize(serverEvents, { age, gender }, taste.get());
};

// Fetches the feed when the preferences changed since the last load, or always with `force`
export function loadFeed(force = false) {
  const query = new URLSearchParams(preferences.get()).toString();
  if (!force && query === lastQuery) return;
  lastQuery = query;

  controller?.abort();
  const current = new AbortController();
  controller = current;
  feed.set({ loading: true, error: null });

  fetch(`/api/events?${query}`, { signal: current.signal })
    .then(async (response) => {
      const data = (await response.json()) as EventsResponse;
      if ('error' in data) throw new Error(data.error);
      serverEvents = data.events;
      feed.set({ events: personalized(), loading: false, error: null });
    })
    .catch((error: unknown) => {
      // A newer request replaced this one
      if (current.signal.aborted) return;
      serverEvents = [];
      feed.set({ events: [], loading: false, error: error instanceof Error ? error.message : 'Something went wrong' });
    });
}

export const refreshFeed = () => loadFeed(true);

// Editing preferences reloads the feed (pinned events are kept, they live in their own store)
preferences.subscribe(() => {
  if (lastQuery !== null) loadFeed();
});

// A new age or gender re-ranks the events already loaded
let lastProfile = `${profile.get().age}|${profile.get().gender}`;
profile.subscribe(() => {
  const next = `${profile.get().age}|${profile.get().gender}`;
  if (next === lastProfile) return;
  lastProfile = next;
  if (serverEvents.length) feed.set({ events: personalized() });
});
