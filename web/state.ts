import { createStore } from '@/web/store';
import type { EventItem } from '@/types/events';
import type { PreferenceValues } from '@/types/preferences';

// Local stand-in for real sign-in: just a first name, kept in this browser.
export const auth = createStore(
  { firstName: null as string | null, onboarded: false },
  { key: 'auth', version: 1 },
);

export const profile = createStore({ name: 'Your Name' }, { key: 'profile', version: 1 });

const DEFAULT_PREFERENCES: PreferenceValues = {
  location: 'New York, NY',
  distance: '5',
  days: 'Fri, Sat, Sun',
  times: '6:00 PM - 10:00 PM',
  interests: 'Running, Movies, Finance',
};

export const preferences = createStore(DEFAULT_PREFERENCES, { key: 'preferences', version: 1 });

type LastArchive = {
  event: EventItem;
  // Archived from the Pinned page, so undoing pins it again
  wasPinned: boolean;
};

type EventsState = {
  // Whole events, not ids, because the scraped feed changes and a pinned event may no longer be in it
  pinnedEvents: EventItem[];
  archivedIds: string[];
  // True after a pin until the user opens the Pinned tab
  hasNewPin: boolean;
  // Most recent archive that can still be undone; not saved
  lastArchive: LastArchive | null;
};

export const events = createStore<EventsState>(
  { pinnedEvents: [], archivedIds: [], hasNewPin: false, lastArchive: null },
  { key: 'events', version: 1, pick: ({ pinnedEvents, archivedIds, hasNewPin }) => ({ pinnedEvents, archivedIds, hasNewPin }) },
);

export function signIn(firstName: string) {
  // Also shown on the Settings profile card
  profile.set({ name: firstName });
  auth.set({ firstName });
}

export function completeOnboarding(values: PreferenceValues) {
  preferences.set(values);
  auth.set({ onboarded: true });
}

export const signOut = () => auth.set({ firstName: null, onboarded: false });

export const pin = (event: EventItem) =>
  events.set((state) =>
    state.pinnedEvents.some((pinned) => pinned.id === event.id)
      ? state
      : { pinnedEvents: [...state.pinnedEvents, event], hasNewPin: true },
  );

export const clearNewPin = () => {
  if (events.get().hasNewPin) events.set({ hasNewPin: false });
};

// Unpinning archives the event too, so it doesn't come back into the feed
export const unpin = (id: string) =>
  events.set((state) => {
    const event = state.pinnedEvents.find((pinned) => pinned.id === id);
    if (!event) return state;
    return {
      pinnedEvents: state.pinnedEvents.filter((pinned) => pinned.id !== id),
      archivedIds: state.archivedIds.includes(id) ? state.archivedIds : [...state.archivedIds, id],
      lastArchive: { event, wasPinned: true },
    };
  });

export const archive = (event: EventItem) =>
  events.set((state) =>
    state.archivedIds.includes(event.id)
      ? state
      : { archivedIds: [...state.archivedIds, event.id], lastArchive: { event, wasPinned: false } },
  );

export const undoArchive = () =>
  events.set((state) => {
    const last = state.lastArchive;
    if (!last) return state;
    const alreadyPinned = state.pinnedEvents.some((pinned) => pinned.id === last.event.id);
    return {
      archivedIds: state.archivedIds.filter((archivedId) => archivedId !== last.event.id),
      pinnedEvents: last.wasPinned && !alreadyPinned ? [...state.pinnedEvents, last.event] : state.pinnedEvents,
      lastArchive: null,
    };
  });

export const clearLastArchive = () => events.set({ lastArchive: null });
