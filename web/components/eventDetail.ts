import { SOURCE_LABELS } from '@/constants/categories';
import { eventImage } from '@/web/components/eventCard';
import { openSheet, type Sheet } from '@/web/components/sheet';
import { h, tintedImage } from '@/web/dom';
import { formatPlace, formatPrice, formatWhen } from '@/web/format';
import type { EventItem } from '@/types/events';

type DetailOptions = {
  // Leave out on the Pinned page, where the event is already pinned
  onPin?: (event: EventItem) => void;
  onArchive: (event: EventItem) => void;
  // Label for the archive button, e.g. "Unpin"
  archiveLabel?: string;
  onClose?: () => void;
};

// The expanded event: image, title linking to the listing, when and where, and the description.
export function openEventDetail(event: EventItem, { onPin, onArchive, archiveLabel = 'Archive', onClose }: DetailOptions): Sheet {
  const meta = [formatPlace(event), formatPrice(event.price), event.distanceMiles !== undefined && `${event.distanceMiles} mi away`]
    .filter(Boolean)
    .join(' · ');

  let sheet: Sheet | null = null;
  const act = (action: (event: EventItem) => void) => () => {
    action(event);
    sheet?.close();
  };

  const content = h(
    'div',
    { class: 'event-detail__content' },
    h('div', { class: 'event-detail__image' }, eventImage(event, 56)),
    h(
      'h2',
      { class: 'event-detail__title' },
      // The icon sits inline after the title so it follows the last word when it wraps
      h('a', { href: event.externalUrl, target: '_blank', rel: 'noopener noreferrer' }, event.title, ' ', tintedImage('external-link-icon', 'tinted event-detail__link-icon')),
    ),
    event.host && h('p', { class: 'event-detail__host' }, event.host),
    h('p', { class: 'event-detail__when' }, formatWhen(event.startAt, event.endAt)),
    h('p', { class: 'event-detail__meta' }, meta),
    // Credits the site the event was found on; the title opens it there
    h('p', { class: 'event-detail__source' }, `Listed on ${SOURCE_LABELS[event.source]}`),
    event.description && h('h3', { class: 'event-detail__section' }, 'About Event'),
    event.description && h('p', { class: 'event-detail__description' }, event.description),
    h(
      'div',
      { class: 'event-detail__actions' },
      h('button', { class: 'event-detail__action event-detail__action--archive', type: 'button', onclick: act(onArchive) }, archiveLabel),
      onPin && h('button', { class: 'event-detail__action event-detail__action--pin', type: 'button', onclick: act(onPin) }, 'Pin'),
    ),
  );

  sheet = openSheet({ className: 'event-detail', label: event.title, content, onClose });
  return sheet;
}
