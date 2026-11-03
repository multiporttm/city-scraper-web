// Ionicons (ionicons.com), the same icon set the app used before, inlined as SVG markup at build time.
import barbell from 'ionicons-svg/barbell-outline.svg';
import body from 'ionicons-svg/body-outline.svg';
import book from 'ionicons-svg/book-outline.svg';
import calendarClear from 'ionicons-svg/calendar-clear-outline.svg';
import calendar from 'ionicons-svg/calendar-outline.svg';
import camera from 'ionicons-svg/camera-outline.svg';
import checkmarkCircle from 'ionicons-svg/checkmark-circle-outline.svg';
import chevronForward from 'ionicons-svg/chevron-forward.svg';
import close from 'ionicons-svg/close.svg';
import cloudOffline from 'ionicons-svg/cloud-offline-outline.svg';
import colorPalette from 'ionicons-svg/color-palette-outline.svg';
import film from 'ionicons-svg/film-outline.svg';
import flower from 'ionicons-svg/flower-outline.svg';
import gameController from 'ionicons-svg/game-controller-outline.svg';
import happy from 'ionicons-svg/happy-outline.svg';
import hardwareChip from 'ionicons-svg/hardware-chip-outline.svg';
import leaf from 'ionicons-svg/leaf-outline.svg';
import musicalNotes from 'ionicons-svg/musical-notes-outline.svg';
import people from 'ionicons-svg/people-outline.svg';
import restaurant from 'ionicons-svg/restaurant-outline.svg';
import shirt from 'ionicons-svg/shirt-outline.svg';
import sparkles from 'ionicons-svg/sparkles-outline.svg';
import ticket from 'ionicons-svg/ticket-outline.svg';
import trendingUp from 'ionicons-svg/trending-up-outline.svg';
import walk from 'ionicons-svg/walk-outline.svg';
import wine from 'ionicons-svg/wine-outline.svg';

import type { EventIcon } from '@/types/events';

const CATEGORY_ICONS: Record<EventIcon, string> = {
  'musical-notes-outline': musicalNotes,
  'restaurant-outline': restaurant,
  'leaf-outline': leaf,
  'color-palette-outline': colorPalette,
  'barbell-outline': barbell,
  'happy-outline': happy,
  'book-outline': book,
  'wine-outline': wine,
  'body-outline': body,
  'camera-outline': camera,
  'film-outline': film,
  'sparkles-outline': sparkles,
  'hardware-chip-outline': hardwareChip,
  'ticket-outline': ticket,
  'flower-outline': flower,
  'game-controller-outline': gameController,
  'walk-outline': walk,
  'shirt-outline': shirt,
  'people-outline': people,
  'trending-up-outline': trendingUp,
  'calendar-outline': calendar,
};

const UI_ICONS = {
  'calendar-clear-outline': calendarClear,
  'checkmark-circle-outline': checkmarkCircle,
  'chevron-forward': chevronForward,
  close,
  'cloud-offline-outline': cloudOffline,
};

export type IconName = EventIcon | keyof typeof UI_ICONS;

const ICONS: Record<IconName, string> = { ...CATEGORY_ICONS, ...UI_ICONS };

// SVG markup for an icon, drawn in the surrounding text color
export const iconSvg = (name: IconName) => ICONS[name] ?? ICONS['calendar-outline'];

export function icon(name: IconName, size: number, className = 'icon') {
  const element = document.createElement('span');
  element.className = className;
  element.setAttribute('aria-hidden', 'true');
  element.style.setProperty('--icon-size', `${size}px`);
  element.innerHTML = iconSvg(name);
  return element;
}
