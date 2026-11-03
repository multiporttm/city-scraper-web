import { AppleMap, initAppleMaps } from '@/web/components/appleMap';
import type { EventMapOptions, MapBackend } from '@/web/components/mapShared';
import type { EventItem } from '@/types/events';

// The fallback map's library is large, so it's only downloaded when Apple Maps isn't available
async function createFallback(container: HTMLElement, options: EventMapOptions) {
  const { FallbackMap } = await import('@/web/components/fallbackMap');
  return new FallbackMap(container, options);
}

// The Explore map: a pin per event, colored like its card, following the top card of the stack.
// Draws with Apple Maps when the Worker has MapKit keys, otherwise with a free dark OpenFreeMap map,
// so the site still works before Apple Maps is set up (e.g. in local development).
export class EventMap {
  private backend: MapBackend | null = null;
  // The latest events, replayed once the map provider is ready
  private latest: { events: EventItem[]; activeId: string | undefined } | null = null;

  constructor(container: HTMLElement, options: EventMapOptions) {
    this.start(container, options);
  }

  private async start(container: HTMLElement, options: EventMapOptions) {
    let backend: MapBackend | null = null;
    if (await initAppleMaps()) {
      try {
        backend = new AppleMap(container, options);
      } catch (error) {
        console.warn('[map] Apple Maps failed, using the fallback map', error);
      }
    }
    this.backend = backend ?? (await createFallback(container, options));
    this.backend.resize();
    if (this.latest) this.backend.setEvents(this.latest.events, this.latest.activeId, false);
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
