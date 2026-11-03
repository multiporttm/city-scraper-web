import { createStore } from '@/web/store';
import { preferences } from '@/web/state';
import type { EventItem } from '@/types/events';

type FeedState = {
  events: EventItem[];
  loading: boolean;
  error: string | null;
};

type EventsResponse = { events: EventItem[] } | { error: string };

// The ranked feed from /api/events for the saved preferences. Lives outside the screens, so switching tabs doesn't refetch.
export const feed = createStore<FeedState>({ events: [], loading: false, error: null });

let lastQuery: string | null = null;
let controller: AbortController | null = null;

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
      feed.set({ events: data.events, loading: false, error: null });
    })
    .catch((error: unknown) => {
      // A newer request replaced this one
      if (current.signal.aborted) return;
      feed.set({ events: [], loading: false, error: error instanceof Error ? error.message : 'Something went wrong' });
    });
}

export const refreshFeed = () => loadFeed(true);

// Editing preferences reloads the feed (pinned events are kept, they live in their own store)
preferences.subscribe(() => {
  if (lastQuery !== null) loadFeed();
});
