import { withToneSequence } from '@/constants/tones';
import { emptyState } from '@/web/components/emptyState';
import { eventCard } from '@/web/components/eventCard';
import { openEventDetail } from '@/web/components/eventDetail';
import { EventMap } from '@/web/components/eventMap';
import { sheetIsOpen } from '@/web/components/sheet';
import { makeSwipeable, type Swipeable } from '@/web/components/swipe';
import { h, replaceChildren } from '@/web/dom';
import { feed, loadFeed, refreshFeed } from '@/web/feed';
import { tiltFor } from '@/web/format';
import { archive, events as eventsStore, pin } from '@/web/state';
import type { TabScreen } from '@/web/screens/types';
import type { EventItem } from '@/types/events';

const VISIBLE_CARDS = 3;
const HEADER_HIDE_DELAY_MS = 3000;

// Keeps events that are neither pinned nor archived
function unseen(events: EventItem[]) {
  const { pinnedEvents, archivedIds } = eventsStore.get();
  const seen = new Set([...pinnedEvents.map((event) => event.id), ...archivedIds]);
  return events.filter((event) => !seen.has(event.id));
}

// Full-screen map with the feed as a stack of cards: drag right to pin, left to archive, click to recenter or open.
export function exploreScreen(): TabScreen {
  // Leaflet sets `position: relative` on its container when it's created before being added to the page,
  // so the map gets its own element inside the absolutely positioned layer
  const mapCanvas = h('div', { class: 'discover-screen__map-canvas' });
  const mapElement = h('div', { class: 'discover-screen__map' }, mapCanvas);
  const pinWash = h('div', { class: 'swipe-backdrop swipe-backdrop--pin' });
  const archiveWash = h('div', { class: 'swipe-backdrop swipe-backdrop--archive' });
  const title = h('h1', { class: 'screen-header__title' }, 'Explore');
  const subtitle = h('p', { class: 'screen-header__subtitle screen-header__subtitle--light', 'aria-live': 'polite' });
  const header = h('header', { class: 'screen-header discover-screen__header' }, title, subtitle);
  const body = h('div', { class: 'discover-screen__body' });
  const element = h(
    'main',
    { class: 'discover-screen' },
    mapElement,
    pinWash,
    archiveWash,
    h('div', { class: 'discover-screen__overlay' }, header, body),
  );

  // Colors follow the feed order when it loads, then stay with each card as it moves up the stack
  let toned: EventItem[] = [];
  let tonedFrom: EventItem[] | null = null;
  // Events picked from the map go first (latest on top), so the previous top card stays right underneath
  let promotedIds: string[] = [];
  let keepZoom = false;
  let centered = true;
  let visible = false;
  let topCard: Swipeable | null = null;
  let detailOpen = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const map = new EventMap(mapCanvas, {
    onSelect: (id) => {
      promotedIds = [id, ...promotedIds.filter((existing) => existing !== id)];
      keepZoom = true;
      render();
    },
    onCenteredChange: (value) => (centered = value),
    onInteract: () => showHeader(),
  });

  // Shows the header, then hides it after a while. Each call restarts the countdown.
  const showHeader = () => {
    header.classList.remove('discover-screen__header--hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => header.classList.add('discover-screen__header--hidden'), HEADER_HIDE_DELAY_MS);
  };

  const setWash = (progress: number, animate: boolean) => {
    for (const wash of [pinWash, archiveWash]) wash.style.transition = animate ? 'opacity 300ms ease-out' : 'none';
    pinWash.style.opacity = String(Math.max(progress, 0));
    archiveWash.style.opacity = String(Math.max(-progress, 0));
  };

  const currentFeed = () => {
    const { events } = feed.get();
    if (events !== tonedFrom) {
      tonedFrom = events;
      toned = withToneSequence(unseen(events));
      promotedIds = [];
    }
    const base = unseen(toned);
    const byId = new Map(base.map((event) => [event.id, event]));
    const promoted = promotedIds.flatMap((id) => byId.get(id) ?? []);
    const promotedSet = new Set(promotedIds);
    return [...promoted, ...base.filter((event) => !promotedSet.has(event.id))];
  };

  const openDetail = (event: EventItem) => {
    detailOpen = true;
    clearTimeout(hideTimer);
    openEventDetail(event, {
      onPin: pin,
      onArchive: archive,
      onClose: () => {
        detailOpen = false;
        showHeader();
      },
    });
  };

  const renderBody = (events: EventItem[]) => {
    const { loading, error, events: all } = feed.get();
    topCard = null;
    if (events.length > 0) {
      const stack = h('div', { class: 'event-stack' });
      // Back to front so the top card is drawn last. Cards behind sit exactly where the top card does.
      events
        .slice(0, VISIBLE_CARDS)
        .map((event, depth) => ({ event, depth }))
        .reverse()
        .forEach(({ event, depth }) => {
          const card = eventCard(event);
          const item = h('div', { class: 'event-stack__item', style: `transform: rotate(${tiltFor(event.id)}deg)` }, card);
          if (depth === 0) {
            card.classList.add('event-card--interactive');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `${event.title}. Drag right or press the right arrow to pin, left to archive.`);
            topCard = makeSwipeable(card, {
              onSwipeRight: () => pin(event),
              onSwipeLeft: () => archive(event),
              // First click brings the map back to the event; once it's centered, clicking again opens the details
              onPress: () => (centered ? openDetail(event) : map.recenter()),
              onProgress: setWash,
            });
          }
          stack.append(item);
        });
      replaceChildren(body, stack);
      return;
    }
    if (loading) {
      replaceChildren(
        body,
        emptyState({
          title: 'Finding events near you',
          message: 'Checking Luma, Meetup, Eventbrite, NYC Parks and more for events that fit your preferences.',
          loading: true,
        }),
      );
    } else if (error) {
      replaceChildren(body, emptyState({ icon: 'cloud-offline-outline', title: "Couldn't load events", message: error, action: { label: 'Try again', onPress: refreshFeed } }));
    } else if (all.length === 0) {
      replaceChildren(
        body,
        emptyState({
          title: 'No events match yet',
          message: 'Nothing fits your availability and distance right now. Try widening them in Settings.',
          action: { label: 'Refresh', onPress: refreshFeed },
        }),
      );
    } else {
      replaceChildren(
        body,
        emptyState({ icon: 'checkmark-circle-outline', title: "You're all caught up", message: "You've gone through every event for now. Check back soon for more." }),
      );
    }
  };

  let lastTopId: string | undefined;
  const render = () => {
    const events = currentFeed();
    const count = events.length.toLocaleString('en-US');
    subtitle.textContent = `${count} ${events.length === 1 ? 'new event' : 'new events'} discovered matching your interests, availability, location, and commutable distance`;
    renderBody(events);
    map.setEvents(events, events[0]?.id, keepZoom);
    keepZoom = false;
    // A new top card re-shows the header
    if (events[0]?.id !== lastTopId && visible && !detailOpen) showHeader();
    lastTopId = events[0]?.id;
  };

  feed.subscribe(render);
  eventsStore.subscribe(render);

  // Arrow keys swipe the top card on desktop
  document.addEventListener('keydown', (event) => {
    if (!visible || sheetIsOpen() || !topCard || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea')) return;
    if (event.key === 'ArrowRight') topCard.fling('right');
    else if (event.key === 'ArrowLeft') topCard.fling('left');
    else return;
    event.preventDefault();
  });

  render();

  return {
    element,
    show: () => {
      visible = true;
      loadFeed();
      // The map was hidden, so Leaflet re-measures before drawing (and re-centers, unless the user had panned away)
      requestAnimationFrame(() => {
        map.resize();
        if (centered) map.recenter();
      });
      showHeader();
    },
    hide: () => {
      visible = false;
      clearTimeout(hideTimer);
    },
  };
}
