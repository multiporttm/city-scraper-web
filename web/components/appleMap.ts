import {
  MAX_PINS,
  NYC,
  PIN_Y_RATIO,
  pinHtml,
  pinSize,
  REGION_PADDING_RATIO,
  type EventMapOptions,
  type MapBackend,
} from '@/web/components/mapShared';
import type { EventItem } from '@/types/events';

const MAPKIT_SCRIPT = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
const INIT_TIMEOUT_MS = 10_000;
// How much longitude fits across the map when focusing an event (about 1.5 miles in NYC)
const FOCUS_LONGITUDE_SPAN = 0.03;
const START_SPAN = 0.09;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Couldn't load ${src}`));
    document.head.append(script);
  });
}

const fetchToken = async () => {
  const response = await fetch('/api/mapkit-token', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Map token: ${response.status}`);
  return response.text();
};

// Loads MapKit JS and authorizes it with a token from the Worker. Resolves false when Apple Maps
// isn't set up (no keys on the server) or Apple rejects the token, so the caller can fall back.
export async function initAppleMaps(): Promise<boolean> {
  let firstToken: string | null;
  try {
    firstToken = await fetchToken();
    if (!window.mapkit) await loadScript(MAPKIT_SCRIPT);
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), INIT_TIMEOUT_MS);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      resolve(ok);
    };
    mapkit.addEventListener('configuration-change', (event) => {
      if (event.status === 'Initialized') finish(true);
    });
    mapkit.addEventListener('error', (event) => {
      console.warn(`[map] Apple Maps error: ${event.status}`);
      finish(false);
    });
    mapkit.init({
      // MapKit asks again whenever the token is about to expire
      authorizationCallback: (done) => {
        if (firstToken) {
          done(firstToken);
          firstToken = null;
        } else {
          fetchToken().then(done, () => {});
        }
      },
    });
  });
}

type Pin = { annotation: mapkit.Annotation; active: boolean; event: EventItem };

// The Explore map on Apple Maps (MapKit JS), in its dark style.
export class AppleMap implements MapBackend {
  private map: mapkit.Map;
  private pins = new Map<string, Pin>();
  private idsByAnnotation = new Map<mapkit.Annotation, string>();
  private events: EventItem[] = [];
  private activeId: string | undefined;

  constructor(private container: HTMLElement, private options: EventMapOptions) {
    this.map = new mapkit.Map(container, {
      colorScheme: mapkit.Map.ColorSchemes.Dark,
      showsPointsOfInterest: false,
      showsCompass: mapkit.FeatureVisibility.Hidden,
      showsScale: mapkit.FeatureVisibility.Hidden,
      showsZoomControl: false,
      showsMapTypeControl: false,
      showsUserLocationControl: false,
      isRotationEnabled: false,
      region: new mapkit.CoordinateRegion(new mapkit.Coordinate(NYC.latitude, NYC.longitude), new mapkit.CoordinateSpan(START_SPAN, START_SPAN)),
    });
    this.applyPadding();

    // scroll-start and zoom-start only fire for the user's own gestures, not for moves made in code
    const userMoved = () => {
      options.onInteract();
      options.onCenteredChange(false);
    };
    this.map.addEventListener('scroll-start', userMoved);
    this.map.addEventListener('zoom-start', userMoved);
    this.map.addEventListener('single-tap', () => options.onInteract());
    this.map.addEventListener('region-change-end', () => this.drawPins());
    this.map.addEventListener('select', ({ annotation }) => {
      const id = annotation && this.idsByAnnotation.get(annotation);
      if (!annotation || !id) return;
      // Pins act like buttons, so let go of MapKit's selection straight away
      setTimeout(() => (annotation.selected = false));
      options.onInteract();
      const event = this.events.find((item) => item.id === id);
      if (!event) return;
      // The active pin is already on top, so just bring the map back to it
      if (id === this.activeId) this.focus(event, false);
      else options.onSelect(id);
    });
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

  resize() {
    // MapKit follows its container's size by itself; only the space under the tab bar needs updating
    this.applyPadding();
  }

  destroy() {
    this.map.destroy();
  }

  // Keeps Apple's logo and Legal link above the floating tab bar
  private applyPadding() {
    this.map.padding = new mapkit.Padding(0, 0, this.options.bottomInset(), 0);
  }

  // Degrees of longitude per screen pixel at the current zoom
  private longitudePerPixel() {
    const box = this.container.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const left = this.map.convertPointOnPageToCoordinate(new DOMPoint(box.left + box.width / 4, y));
    const right = this.map.convertPointOnPageToCoordinate(new DOMPoint(box.left + (box.width * 3) / 4, y));
    return Math.abs(right.longitude - left.longitude) / (box.width / 2);
  }

  // Moves the map so the event's pin sits in the upper part of the map, above the card stack
  private focus(event: EventItem, keepZoom: boolean) {
    this.options.onCenteredChange(true);
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const inset = this.options.bottomInset();
    const lngPerPx = keepZoom ? this.longitudePerPixel() : FOCUS_LONGITUDE_SPAN / width;
    // Close enough to Web Mercator at city scale
    const latPerPx = lngPerPx * Math.cos((event.latitude * Math.PI) / 180);
    // The region fills the map above the bottom padding, so its middle is (height - inset) / 2 from the top
    const pinToMiddle = (height - inset) / 2 - height * PIN_Y_RATIO;
    const center = new mapkit.Coordinate(event.latitude - pinToMiddle * latPerPx, event.longitude);
    const span = new mapkit.CoordinateSpan(latPerPx * (height - inset), lngPerPx * width);
    this.map.setRegionAnimated(new mapkit.CoordinateRegion(center, span), true);
  }

  private makeAnnotation(event: EventItem, active: boolean) {
    const size = pinSize(active);
    const annotation = new mapkit.Annotation(
      new mapkit.Coordinate(event.latitude, event.longitude),
      () => {
        const element = document.createElement('div');
        element.className = 'event-pin-anchor';
        element.innerHTML = pinHtml(event, active);
        element.title = event.title;
        return element;
      },
      // MapKit anchors annotations at their bottom centre; shifting down by half centres the pin on the spot
      { calloutEnabled: false, animates: false, anchorOffset: new DOMPoint(0, size / 2), size: { width: size, height: size } },
    );
    this.idsByAnnotation.set(annotation, event.id);
    return annotation;
  }

  private remove(id: string) {
    const pin = this.pins.get(id);
    if (!pin) return;
    this.map.removeAnnotation(pin.annotation);
    this.idsByAnnotation.delete(pin.annotation);
    this.pins.delete(id);
  }

  private drawPins() {
    const { center, span } = this.map.region;
    const latPad = span.latitudeDelta * (0.5 + REGION_PADDING_RATIO);
    const lngPad = span.longitudeDelta * (0.5 + REGION_PADDING_RATIO);
    const inView = (event: EventItem) =>
      Math.abs(event.latitude - center.latitude) <= latPad && Math.abs(event.longitude - center.longitude) <= lngPad;

    const active = this.events.find((event) => event.id === this.activeId);
    const nearby = this.events.filter((event) => event.id !== this.activeId && inView(event)).slice(0, MAX_PINS);
    // The active pin is added last so it's drawn on top
    const wanted = active ? [...nearby, active] : nearby;
    const wantedIds = new Set(wanted.map((event) => event.id));

    for (const id of [...this.pins.keys()]) if (!wantedIds.has(id)) this.remove(id);
    for (const event of wanted) {
      const isActive = event.id === this.activeId;
      const existing = this.pins.get(event.id);
      if (existing && existing.active === isActive && existing.event === event) continue;
      // Annotation elements are built once, so a pin that changes is replaced
      this.remove(event.id);
      const annotation = this.makeAnnotation(event, isActive);
      this.map.addAnnotation(annotation);
      this.pins.set(event.id, { annotation, active: isActive, event });
    }
  }
}
