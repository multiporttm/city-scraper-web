import * as maplibregl from 'maplibre-gl';

import { appleLikeStyle } from '@/web/components/mapStyle';
import { MAX_PINS, NYC, PIN_Y_RATIO, pinHtml, REGION_PADDING_RATIO, type EventMapOptions, type MapBackend } from '@/web/components/mapShared';
import type { EventItem } from '@/types/events';

// OpenFreeMap: free vector map tiles on OpenStreetMap data, with no API key, sign-up or view limit.
// Its dark style is the starting point; mapStyle.ts repaints it to look like Apple Maps' dark mode.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
// Copied next to the bundle by build.mjs
maplibregl.setWorkerUrl('/build/maplibre-gl-worker.mjs');

const START_ZOOM = 12;
const FOCUS_ZOOM = 13;
const MAX_FOCUS_ZOOM = 15;
// Too far to glide nicely, so the map jumps instead
const JUMP_DISTANCE_M = 20_000;

type Pin = { marker: maplibregl.Marker; active: boolean; event: EventItem };

// The map when Apple Maps isn't set up: MapLibre drawing OpenFreeMap's data in an Apple Maps-like dark style.
export class FallbackMap implements MapBackend {
  private map: maplibregl.Map;
  private pins = new Map<string, Pin>();
  private events: EventItem[] = [];
  private activeId: string | undefined;

  constructor(private container: HTMLElement, private options: EventMapOptions) {
    this.map = new maplibregl.Map({
      container,
      // An empty style first; the real one is set below so it can be repainted before anything draws
      style: { version: 8, sources: {}, layers: [] },
      center: [NYC.longitude, NYC.latitude],
      zoom: START_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disable();
    // Top right, so it stays clear of the card stack and tab bar
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');

    this.map.setStyle(STYLE_URL, {
      transformStyle: (_previous, next) => appleLikeStyle(next),
    });

    this.collapseCredits();

    // Events carry originalEvent only when the user caused them, not for moves made in code
    this.map.on('dragstart', () => this.userMoved());
    this.map.on('zoomstart', (event) => {
      if (event.originalEvent) this.userMoved();
    });
    this.map.on('click', () => options.onInteract());
    this.map.on('moveend', () => this.drawPins());
  }

  setEvents(events: EventItem[], activeId: string | undefined, keepZoom: boolean) {
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

  // MapLibre measures its container once, so it re-measures after being hidden or resized
  resize() {
    this.map.resize();
  }

  destroy() {
    this.map.remove();
  }

  // MapLibre opens the credits once the map's data arrives. Fold them into the ⓘ button the first time,
  // so they don't cover the header; tapping ⓘ still shows them.
  private collapseCredits() {
    const credits = this.container.querySelector('.maplibregl-ctrl-attrib');
    if (!credits) return;
    const observer = new MutationObserver(() => {
      if (!credits.classList.contains('maplibregl-compact-show')) return;
      credits.classList.remove('maplibregl-compact-show');
      observer.disconnect();
    });
    observer.observe(credits, { attributes: true, attributeFilter: ['class'] });
  }

  private userMoved() {
    this.options.onInteract();
    this.options.onCenteredChange(false);
  }

  // Moves the map so the event's pin sits in the upper part of the map, above the card stack
  private focus(event: EventItem, keepZoom: boolean) {
    this.options.onCenteredChange(true);
    const zoom = keepZoom ? this.map.getZoom() : Math.max(FOCUS_ZOOM, Math.min(this.map.getZoom(), MAX_FOCUS_ZOOM));
    const height = this.container.clientHeight || window.innerHeight;
    const target = new maplibregl.LngLat(event.longitude, event.latitude);
    const far = this.map.getCenter().distanceTo(target) > JUMP_DISTANCE_M;
    this.map.easeTo({
      center: target,
      zoom,
      // Negative y puts the pin above the middle of the map
      offset: [0, -(0.5 - PIN_Y_RATIO) * height],
      duration: far ? 0 : 500,
    });
  }

  private makeMarker(event: EventItem, active: boolean) {
    const element = document.createElement('div');
    element.className = 'event-pin-anchor';
    element.innerHTML = pinHtml(event, active);
    element.title = event.title;
    // The active pin is drawn over the others
    element.style.zIndex = active ? '2' : '1';
    element.addEventListener('click', (click) => {
      click.stopPropagation();
      this.options.onInteract();
      // The active pin is already on top, so just bring the map back to it
      if (event.id === this.activeId) this.focus(event, false);
      else this.options.onSelect(event.id);
    });
    return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([event.longitude, event.latitude]).addTo(this.map);
  }

  private drawPins() {
    const bounds = this.map.getBounds();
    const center = bounds.getCenter();
    const latPad = (bounds.getNorth() - bounds.getSouth()) * (0.5 + REGION_PADDING_RATIO);
    const lngPad = (bounds.getEast() - bounds.getWest()) * (0.5 + REGION_PADDING_RATIO);
    const inView = (event: EventItem) => Math.abs(event.latitude - center.lat) <= latPad && Math.abs(event.longitude - center.lng) <= lngPad;

    const active = this.events.find((event) => event.id === this.activeId);
    const nearby = this.events.filter((event) => event.id !== this.activeId && inView(event)).slice(0, MAX_PINS);
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
      existing?.marker.remove();
      this.pins.set(event.id, { marker: this.makeMarker(event, isActive), active: isActive, event });
    }
  }
}
