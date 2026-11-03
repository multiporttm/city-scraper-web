import { TONE_COLORS } from '@/constants/tones';
import { h } from '@/web/dom';
import { formatPlace, formatPrice, formatWhen } from '@/web/format';
import { icon } from '@/web/icons';
import type { EventItem } from '@/types/events';

// Fills its parent with the event's image, or the category icon on the card's color when the source had none
export function eventImage(event: EventItem, iconSize: number) {
  const fallback = () => h('div', { class: 'event-image__fallback', style: `background-color: ${TONE_COLORS[event.tone]}` }, icon(event.icon, iconSize));
  if (!event.imageUrl) return fallback();
  const image = h('img', { class: 'event-image', src: event.imageUrl, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
  // Some sources link images that have since moved
  image.addEventListener('error', () => image.replaceWith(fallback()), { once: true });
  return image;
}

export function eventCard(event: EventItem) {
  return h(
    'article',
    { class: `event-card event-card--${event.tone}` },
    h(
      'div',
      { class: 'event-card__row' },
      h(
        'div',
        { class: 'event-card__body' },
        h('p', { class: 'event-card__date' }, formatWhen(event.startAt, event.endAt)),
        h('h3', { class: 'event-card__title' }, event.title),
        h('p', { class: 'event-card__description' }, event.description),
      ),
      h('div', { class: 'event-card__thumb' }, eventImage(event, 28)),
    ),
    h(
      'div',
      { class: 'event-card__footer' },
      h('span', { class: 'event-card__venue' }, formatPlace(event)),
      h('span', { class: 'event-card__price' }, formatPrice(event.price)),
    ),
  );
}
