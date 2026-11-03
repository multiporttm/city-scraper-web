import L from 'leaflet';

import { MAX_PINS, NYC, pinHtml, REGION_PADDING_RATIO, type EventMapOptions, type MapBackend } from '@/web/components/mapShared';
import type { EventItem } from '@/types/events';

const START_ZOOM = 13;
const FOCUS_ZOOM = 14;
// Center a bit south of the pin so it sits above the card stack, as a share of the map's height
const CENTER_OFFSET_RATIO = 0.2;

// OpenStreetMap's standard tiles need no API key; CSS (.event-map-tiles) darkens them to match the app.
// They're fine for light use (https://operations.osmfoundation.org/policies/tiles/); swap in a hosted tile provider for heavy traffic.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon(event: EventItem, active: boolean) {
  const size = active ? 44 : 32;
  return L.divIcon({
    className: 'event-pin-anchor',
    html: pinHtml(event, active),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Pin = { marker: L.Marker; active: boolean; event: EventItem };

// Fallback map when Apple Maps isn't configured: Leaflet with OpenStreetMap tiles.
export class LeafletMap implements MapBackend {
  private map: L.Map;
  private pins = new Map<string, Pin>();
  private events: EventItem[] = [];
  private activeId: string | undefined;
  // Set while the map moves on its own, so only the user's drags and zooms count as leaving the event
  private flying = false;

  constructor(container: HTMLElement, private options: EventMapOptions) {
    this.map = L.map(container, { zoomControl: false, attributionControl: false, center: [NYC.latitude, NYC.longitude], zoom: START_ZOOM });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: 'event-map-tiles' }).addTo(this.map);
    // Top right, so it stays clear of the card stack and tab bar
    L.control.attribution({ position: 'topright', prefix: false }).addTo(this.map);

    this.map.on('dragstart', () => {
      options.onInteract();
      options.onCenteredChange(false);
    });
    this.map.on('zoomstart', () => {
      if (this.flying) return;
      options.onInteract();
      options.onCenteredChange(false);
    });
    this.map.on('click', () => options.onInteract());
    this.map.on('moveend', () => {
      this.flying = false;
      this.drawPins();
    });
  }

  setEvents(events: EventItem[], activeId: string | undefined, keepZoom = false) {
    const activeChanged = activeId !== this.activeId;
    this.events = events;
    this.activeId = activeId;
    this.drawPins();
    if (activeChanged) {
      const active = events.find((event) => event.id === activeId);
      if (active) this.focus(active, keepZoom);
    }
  }

  recenter() {
    const active = this.events.find((event) => event.id === this.activeId);
    if (active) this.focus(active, false);
  }

  // Leaflet measures its container once, so it re-measures after being hidden or resized
  resize() {
    this.map.invalidateSize();
  }

  destroy() {
    this.map.remove();
  }

  private focus(event: EventItem, keepZoom: boolean) {
    this.options.onCenteredChange(true);
    const zoom = keepZoom ? this.map.getZoom() : Math.max(FOCUS_ZOOM, Math.min(this.map.getZoom(), 16));
    const offset = this.map.getSize().y * CENTER_OFFSET_RATIO;
    const center = this.map.unproject(this.map.project([event.latitude, event.longitude], zoom).add([0, offset]), zoom);
    this.flying = true;
    const far = this.map.getCenter().distanceTo(center) > 20_000;
    if (far) this.map.setView(center, zoom, { animate: false });
    else this.map.flyTo(center, zoom, { duration: 0.5 });
  }

  private drawPins() {
    const bounds = this.map.getBounds().pad(REGION_PADDING_RATIO);
    const active = this.events.find((event) => event.id === this.activeId);
    const nearby = this.events
      .filter((event) => event.id !== this.activeId && bounds.contains([event.latitude, event.longitude]))
      .slice(0, MAX_PINS);
    const wanted = active ? [...nearby, active] : nearby;
    const wantedIds = new Set(wanted.map((event) => event.id));

    for (const [id, pin] of this.pins) {
      if (!wantedIds.has(id)) {
        pin.marker.remove();
        this.pins.delete(id);
      }
    }
    for (const event of wanted) {
      const isActive = event.id === this.activeId;
      const existing = this.pins.get(event.id);
      // An event's tone can change when the feed reloads, so compare the whole event too
      if (existing && existing.active === isActive && existing.event === event) continue;
      if (existing) {
        existing.marker.setIcon(pinIcon(event, isActive)).setZIndexOffset(isActive ? 1000 : 0);
        this.pins.set(event.id, { ...existing, active: isActive, event });
        continue;
      }
      const marker = L.marker([event.latitude, event.longitude], {
        icon: pinIcon(event, isActive),
        zIndexOffset: isActive ? 1000 : 0,
        keyboard: false,
        title: event.title,
      })
        .on('click', () => {
          this.options.onInteract();
          // The active pin is already on top, so just bring the map back to it
          if (event.id === this.activeId) this.focus(event, false);
          else this.options.onSelect(event.id);
        })
        .addTo(this.map);
      this.pins.set(event.id, { marker, active: isActive, event });
    }
  }
}
