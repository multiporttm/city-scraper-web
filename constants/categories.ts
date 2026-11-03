import type { EventCategory, EventIcon, EventSource, EventTone } from '@/types/events';

type CategoryStyle = { tone: EventTone; icon: EventIcon };

// Card color and map pin icon for each category
export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  Music: { tone: 'pink', icon: 'musical-notes-outline' },
  Food: { tone: 'yellow', icon: 'restaurant-outline' },
  Outdoors: { tone: 'green', icon: 'leaf-outline' },
  Art: { tone: 'pink', icon: 'color-palette-outline' },
  Fitness: { tone: 'green', icon: 'barbell-outline' },
  Comedy: { tone: 'yellow', icon: 'happy-outline' },
  Books: { tone: 'blue', icon: 'book-outline' },
  Nightlife: { tone: 'pink', icon: 'wine-outline' },
  Yoga: { tone: 'green', icon: 'body-outline' },
  Photography: { tone: 'blue', icon: 'camera-outline' },
  Movies: { tone: 'green', icon: 'film-outline' },
  Dance: { tone: 'pink', icon: 'sparkles-outline' },
  Tech: { tone: 'blue', icon: 'hardware-chip-outline' },
  Theater: { tone: 'yellow', icon: 'ticket-outline' },
  Wellness: { tone: 'green', icon: 'flower-outline' },
  Gaming: { tone: 'blue', icon: 'game-controller-outline' },
  Running: { tone: 'green', icon: 'walk-outline' },
  Fashion: { tone: 'pink', icon: 'shirt-outline' },
  Networking: { tone: 'blue', icon: 'people-outline' },
  Finance: { tone: 'yellow', icon: 'trending-up-outline' },
  Other: { tone: 'blue', icon: 'calendar-outline' },
};

// Shown next to the event link, so every event credits where it came from
export const SOURCE_LABELS: Record<EventSource, string> = {
  luma: 'Luma',
  ticketmaster: 'Ticketmaster',
  eventbrite: 'Eventbrite',
  meetup: 'Meetup',
  seatgeek: 'SeatGeek',
  predicthq: 'PredictHQ',
  nycparks: 'NYC Parks',
};
