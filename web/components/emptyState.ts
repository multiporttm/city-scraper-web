import { h } from '@/web/dom';
import { icon, type IconName } from '@/web/icons';

type EmptyStateProps = {
  title: string;
  message: string;
  // An Ionicon, or { image } for a PNG in public/images
  icon?: IconName | { image: string };
  // Shows bouncing dots in place of the icon
  loading?: boolean;
  action?: { label: string; onPress: () => void };
};

const loadingDots = () =>
  h('div', { class: 'loading-dots', role: 'progressbar', 'aria-label': 'Loading' }, [0, 1, 2].map(() => h('span', { class: 'loading-dots__dot' })));

export function emptyState({ title, message, icon: iconName = 'calendar-clear-outline', loading, action }: EmptyStateProps) {
  const art = loading
    ? h('div', { class: 'empty-state__loading' }, loadingDots())
    : typeof iconName === 'string'
      ? h('div', { class: 'empty-state__icon' }, icon(iconName, 36))
      : h('div', { class: 'empty-state__image' }, h('img', { src: `/images/${iconName.image}.png`, alt: '' }));

  return h(
    'section',
    { class: 'empty-state' },
    art,
    h('h2', { class: 'empty-state__title' }, title),
    h('p', { class: 'empty-state__message' }, message),
    action && h('button', { class: 'empty-state__action', type: 'button', onclick: action.onPress }, action.label),
  );
}
