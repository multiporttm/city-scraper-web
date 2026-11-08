// The interest taxonomy from the quiz (INTEREST_OPTIONS in data/preferences.ts), plus 'Other' for events that match none
export type EventCategory =
  | 'Music'
  | 'Food'
  | 'Outdoors'
  | 'Art'
  | 'Fitness'
  | 'Comedy'
  | 'Books'
  | 'Nightlife'
  | 'Yoga'
  | 'Photography'
  | 'Movies'
  | 'Dance'
  | 'Tech'
  | 'Theater'
  | 'Wellness'
  | 'Gaming'
  | 'Running'
  | 'Fashion'
  | 'Networking'
  | 'Finance'
  | 'Other';

export type EventTone = 'green' | 'pink' | 'blue' | 'yellow';

// Ionicons names (ionicons.com) for the category icons on map pins and image placeholders
export type EventIcon =
  | 'musical-notes-outline'
  | 'restaurant-outline'
  | 'leaf-outline'
  | 'color-palette-outline'
  | 'barbell-outline'
  | 'happy-outline'
  | 'book-outline'
  | 'wine-outline'
  | 'body-outline'
  | 'camera-outline'
  | 'film-outline'
  | 'sparkles-outline'
  | 'hardware-chip-outline'
  | 'ticket-outline'
  | 'flower-outline'
  | 'game-controller-outline'
  | 'walk-outline'
  | 'shirt-outline'
  | 'people-outline'
  | 'trending-up-outline'
  | 'calendar-outline';

export type EventSource = 'luma' | 'ticketmaster' | 'eventbrite' | 'meetup' | 'seatgeek' | 'predicthq' | 'nycparks';

export type EventItem = {
  // `${source}-${source's own id}`
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  venue: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  // ISO 8601, e.g. 2026-10-30T23:30:00.000Z. Shown in New York time.
  startAt: string;
  // Same format as startAt. Estimated (start + 2h) when the source has no end time.
  endAt: string;
  // 0 means free, null means the source didn't say
  price: number | null;
  tone: EventTone;
  icon: EventIcon;
  imageUrl: string | null;
  host: string;
  externalUrl: string;
  source: EventSource;
  // Distance from the user's location, set when the feed is ranked
  distanceMiles?: number;
  // How well the event fits the user's preferences, set by the server's ranking (higher is better)
  score?: number;
};
