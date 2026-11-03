import { withToneSequence } from '@/constants/tones';
import { emptyState } from '@/web/components/emptyState';
import { eventCard } from '@/web/components/eventCard';
import { openEventDetail } from '@/web/components/eventDetail';
import { makeSwipeable } from '@/web/components/swipe';
import { h, replaceChildren } from '@/web/dom';
import { icon } from '@/web/icons';
import { clearNewPin, events as eventsStore, unpin } from '@/web/state';
import type { TabScreen } from '@/web/screens/types';

// Saved events by date. Dragging a card left unpins and archives it, so it doesn't return to the feed.
export function pinnedScreen(): TabScreen {
  const list = h('div', { class: 'pinned-list' });
  const element = h(
    'main',
    { class: 'tab-screen' },
    h(
      'div',
      { class: 'tab-screen__content' },
      h('header', { class: 'screen-header' }, h('h1', { class: 'screen-header__title' }, 'Pinned'), h('p', { class: 'screen-header__subtitle' }, 'Your saved events')),
      list,
    ),
  );
  let visible = false;

  const render = () => {
    const pinned = withToneSequence([...eventsStore.get().pinnedEvents].sort((a, b) => a.startAt.localeCompare(b.startAt)));
    if (pinned.length === 0) {
      replaceChildren(
        list,
        emptyState({ icon: { image: 'pinned-icons' }, title: 'Nothing pinned yet', message: 'Drag an event to the right on Explore to pin it and it will show up here.' }),
      );
      return;
    }
    replaceChildren(
      list,
      pinned.map((event) => {
        const card = eventCard(event);
        card.classList.add('event-card--interactive');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${event.title}. Drag left to unpin.`);
        const archivePanel = h('div', { class: 'swipe-card__archive' }, icon('close', 28));
        makeSwipeable(card, {
          onSwipeLeft: () => unpin(event.id),
          onPress: () => openEventDetail(event, { onArchive: () => unpin(event.id), archiveLabel: 'Unpin' }),
          archivePanel,
        });
        return h('div', { class: 'pinned-item' }, archivePanel, card);
      }),
    );
  };

  eventsStore.subscribe(() => {
    render();
    // Opening the tab counts as seeing the new pin
    if (visible) clearNewPin();
  });
  render();

  return {
    element,
    show: () => {
      visible = true;
      clearNewPin();
    },
    hide: () => (visible = false),
  };
}
