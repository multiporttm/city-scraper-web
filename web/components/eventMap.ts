import { AppleMap, initAppleMaps } from '@/web/components/appleMap';
import { LeafletMap } from '@/web/components/leafletMap';
import type { EventMapOptions, MapBackend } from '@/web/components/mapShared';
import type { EventItem } from '@/types/events';

// The Explore map: a pin per event, colored like its card, following the top card of the stack.
// Draws with Apple Maps when the Worker has MapKit keys, otherwise falls back to OpenStreetMap,
// so the site still works before Apple Maps is set up (e.g. in local development).
export class EventMap {
  private backend: MapBackend | null = null;
  // The latest events, replayed once the map provider is ready
  private latest: { events: EventItem[]; activeId: string | undefined } | null = null;

  constructor(container: HTMLElement, options: EventMapOptions) {
    initAppleMaps().then((apple) => {
      try {
        this.backend = apple ? new AppleMap(container, options) : new LeafletMap(container, options);
      } catch (error) {
        console.warn('[map] Apple Maps failed, using OpenStreetMap', error);
        this.backend = new LeafletMap(container, options);
      }
      this.backend.resize();
      if (this.latest) this.backend.setEvents(this.latest.events, this.latest.activeId, false);
    });
  }

  setEvents(events: EventItem[], activeId: string | undefined, keepZoom = false) {
    this.latest = { events, activeId };
    this.backend?.setEvents(events, activeId, keepZoom);
  }

  recenter() {
    this.backend?.recenter();
  }

  resize() {
    this.backend?.resize();
  }
}
