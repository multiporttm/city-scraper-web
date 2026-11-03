import 'maplibre-gl/dist/maplibre-gl.css';
import '@/web/styles.css';

import { cx, h, tintedImage } from '@/web/dom';
import { exploreScreen } from '@/web/screens/explore';
import { pinnedScreen } from '@/web/screens/pinned';
import { quizScreen } from '@/web/screens/quiz';
import { settingsScreen } from '@/web/screens/settings';
import { signInScreen } from '@/web/screens/signIn';
import type { TabScreen } from '@/web/screens/types';
import { auth, clearLastArchive, events as eventsStore, undoArchive } from '@/web/state';

type TabId = 'explore' | 'pinned' | 'settings';

const TABS: { id: TabId; path: string; label: string; image: string; create: () => TabScreen }[] = [
  { id: 'explore', path: '/', label: 'Explore', image: 'house-icon', create: exploreScreen },
  { id: 'pinned', path: '/pinned', label: 'Pinned', image: 'calendar-add', create: pinnedScreen },
  { id: 'settings', path: '/settings', label: 'Settings', image: 'person-icon', create: settingsScreen },
];

const UNDO_VISIBLE_MS = 4000;
const APP_NAME = 'City Scraper';

export function navigate(path: string) {
  if (location.pathname !== path) history.pushState(null, '', path);
  route();
}

// The signed-in app: one screen per tab (each built on first visit, then kept), the floating tab bar and the Undo button.
function createShell() {
  const screens = new Map<TabId, TabScreen>();
  const content = h('div', { class: 'shell__content' });
  let current: TabId | null = null;

  const links = TABS.map((tab) =>
    h(
      'a',
      {
        class: 'tab-bar__item',
        href: tab.path,
        'data-tab': tab.id,
        onclick: (event: MouseEvent) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          navigate(tab.path);
        },
      },
      h('span', { class: 'tab-bar__icon' }, tintedImage(tab.image), tab.id === 'pinned' && h('span', { class: 'tab-bar__badge', hidden: true })),
      h('span', { class: 'tab-bar__label' }, tab.label),
    ),
  );
  const indicator = h('span', { class: 'tab-bar__indicator', 'aria-hidden': 'true' });
  const tabBar = h('nav', { class: 'tab-bar', 'aria-label': 'Main' }, indicator, links);
  const badge = tabBar.querySelector<HTMLElement>('.tab-bar__badge')!;

  const undo = h('button', { class: 'undo-archive', type: 'button', hidden: true, onclick: undoArchive }, 'Undo');
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let lastArchive = eventsStore.get().lastArchive;

  const syncEvents = () => {
    const state = eventsStore.get();
    badge.hidden = !state.hasNewPin;
    // Each archive sets a new object, so archiving again restarts the timer
    if (state.lastArchive !== lastArchive) {
      lastArchive = state.lastArchive;
      clearTimeout(undoTimer);
      if (lastArchive) undoTimer = setTimeout(clearLastArchive, UNDO_VISIBLE_MS);
    }
    undo.hidden = !state.lastArchive || current === 'settings';
  };
  eventsStore.subscribe(syncEvents);

  const element = h('div', { class: 'shell' }, content, undo, tabBar);

  return {
    element,
    show(tabId: TabId) {
      if (current === tabId) return;
      if (current) {
        screens.get(current)?.hide();
        screens.get(current)!.element.hidden = true;
      }
      let screen = screens.get(tabId);
      if (!screen) {
        screen = TABS.find((tab) => tab.id === tabId)!.create();
        screens.set(tabId, screen);
        content.append(screen.element);
      }
      screen.element.hidden = false;
      current = tabId;
      const index = TABS.findIndex((tab) => tab.id === tabId);
      links.forEach((link, i) => {
        link.classList.toggle('tab-bar__item--active', i === index);
        if (i === index) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      indicator.style.setProperty('--index', String(index));
      // The bar turns see-through over the map
      tabBar.className = cx('tab-bar', tabId === 'explore' && 'tab-bar--translucent');
      document.title = `${TABS[index].label} · ${APP_NAME}`;
      syncEvents();
      screen.show();
    },
    hide() {
      if (current) {
        screens.get(current)?.hide();
        screens.get(current)!.element.hidden = true;
      }
      current = null;
    },
  };
}

const app = document.getElementById('app')!;
let shell: ReturnType<typeof createShell> | null = null;
let mode: 'sign-in' | 'quiz' | 'tabs' | null = null;

// Signed out → /sign-in, signed in but no quiz yet → /quiz, otherwise the tabs
function route() {
  const { firstName, onboarded } = auth.get();
  const wanted = !firstName ? 'sign-in' : !onboarded ? 'quiz' : 'tabs';

  if (wanted !== 'tabs') {
    if (location.pathname !== `/${wanted}`) history.replaceState(null, '', `/${wanted}`);
    if (mode !== wanted) {
      shell?.hide();
      mode = wanted;
      app.replaceChildren(wanted === 'sign-in' ? signInScreen() : quizScreen());
      document.title = wanted === 'sign-in' ? APP_NAME : `Your preferences · ${APP_NAME}`;
    }
    return;
  }

  const tab = TABS.find((item) => item.path === location.pathname);
  if (!tab) history.replaceState(null, '', '/');
  if (mode !== 'tabs') {
    shell ??= createShell();
    mode = 'tabs';
    app.replaceChildren(shell.element);
  }
  shell!.show(tab?.id ?? 'explore');
}

window.addEventListener('popstate', route);
auth.subscribe(route);
route();
