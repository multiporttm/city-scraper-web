import { EMPTY_TASTE, learnTaste, TASTE_WEIGHTS, type Gender, type Taste } from '@/lib/personalize';
import { createStore } from '@/web/store';
import type { EventItem } from '@/types/events';
import type { PreferenceValues } from '@/types/preferences';

// Local stand-in for real sign-in: just a first name, kept in this browser.
export const auth = createStore(
  { firstName: null as string | null, onboarded: false },
  { key: 'auth', version: 1 },
);

// Age and gender are optional and stay in this browser; they only fine-tune the feed (lib/personalize.ts)
export const profile = createStore(
  { name: 'Your Name', age: null as number | null, gender: null as Gender | null },
  { key: 'profile', version: 1 },
);

// Event types and hosts the user tends to pin or archive, learned as they go
export const taste = createStore<Taste>(EMPTY_TASTE, { key: 'taste', version: 1 });

const learn = (event: EventItem, weight: number) => taste.set((state) => learnTaste(state, event, weight));

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

export const pin = (event: EventItem) => {
  if (events.get().pinnedEvents.some((pinned) => pinned.id === event.id)) return;
  events.set((state) => ({ pinnedEvents: [...state.pinnedEvents, event], hasNewPin: true }));
  learn(event, TASTE_WEIGHTS.pin);
};

export const clearNewPin = () => {
  if (events.get().hasNewPin) events.set({ hasNewPin: false });
};

// Unpinning archives the event too, so it doesn't come back into the feed
export const unpin = (id: string) => {
  const event = events.get().pinnedEvents.find((pinned) => pinned.id === id);
  if (!event) return;
  events.set((state) => ({
    pinnedEvents: state.pinnedEvents.filter((pinned) => pinned.id !== id),
    archivedIds: state.archivedIds.includes(id) ? state.archivedIds : [...state.archivedIds, id],
    lastArchive: { event, wasPinned: true },
  }));
  learn(event, TASTE_WEIGHTS.unpin);
};

export const archive = (event: EventItem) => {
  if (events.get().archivedIds.includes(event.id)) return;
  events.set((state) => ({ archivedIds: [...state.archivedIds, event.id], lastArchive: { event, wasPinned: false } }));
  learn(event, TASTE_WEIGHTS.archive);
};

export const undoArchive = () => {
  const last = events.get().lastArchive;
  if (!last) return;
  events.set((state) => {
    const alreadyPinned = state.pinnedEvents.some((pinned) => pinned.id === last.event.id);
    return {
      archivedIds: state.archivedIds.filter((archivedId) => archivedId !== last.event.id),
      pinnedEvents: last.wasPinned && !alreadyPinned ? [...state.pinnedEvents, last.event] : state.pinnedEvents,
      lastArchive: null,
    };
  });
  // Takes back what the archive (or unpin) taught
  learn(last.event, -(last.wasPinned ? TASTE_WEIGHTS.unpin : TASTE_WEIGHTS.archive));
};

// Events pinned before taste learning existed still count
if (Object.keys(taste.get().categories).length === 0 && Object.keys(taste.get().hosts).length === 0) {
  for (const event of events.get().pinnedEvents) learn(event, TASTE_WEIGHTS.pin);
}

export const clearLastArchive = () => events.set({ lastArchive: null });
