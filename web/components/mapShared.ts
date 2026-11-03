import { TONE_COLORS } from '@/constants/tones';
import { iconSvg } from '@/web/icons';
import type { EventItem } from '@/types/events';

export type EventMapOptions = {
  // Called with the event id when a pin other than the active one is clicked
  onSelect: (id: string) => void;
  // false once the user drags or zooms away from the active event, true when the map returns to it
  onCenteredChange: (centered: boolean) => void;
  // Any click, drag or zoom on the map
  onInteract: () => void;
  // Pixels at the bottom of the map covered by the tab bar, kept clear for the map's logo and legal link
  bottomInset: () => number;
};

// What the Explore screen needs from a map, whichever provider draws it
export interface MapBackend {
  // Shows these events, with `activeId` (the top card) highlighted and centered
  setEvents(events: EventItem[], activeId: string | undefined, keepZoom: boolean): void;
  // Brings the map back to the active event after the user panned away
  recenter(): void;
  // Call after the map was hidden or its size changed
  resize(): void;
  destroy(): void;
}

export const NYC = { latitude: 40.7413, longitude: -73.9906 };
// A big feed only draws the pins in (or just around) the visible area, best-ranked first, up to a cap. The active pin is always drawn.
export const MAX_PINS = 150;
export const REGION_PADDING_RATIO = 0.5;
// Where the active pin lands, as a share of the map's height from the top, so it sits above the card stack
export const PIN_Y_RATIO = 0.3;

export const pinSize = (active: boolean) => (active ? 44 : 32);

// A round pin in the card's color with the category icon, the same on every map provider
export const pinHtml = (event: EventItem, active: boolean) =>
  `<div class="event-pin${active ? ' event-pin--active' : ''}" style="background-color: ${TONE_COLORS[event.tone]}">${iconSvg(event.icon)}</div>`;
