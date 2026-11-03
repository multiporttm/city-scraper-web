import { afterPaint, cx, h } from '@/web/dom';
import { icon } from '@/web/icons';

type SheetOptions = {
  // Extra class on the sheet panel, e.g. 'event-detail'
  className?: string;
  label: string;
  content: HTMLElement;
  onClose?: () => void;
};

export type Sheet = { close: () => void; panel: HTMLElement };

const CLOSE_MS = 280;
const DISMISS_DISTANCE = 100;

// Open sheets, newest last, so Escape closes only the top one
const openSheets: Sheet[] = [];

export const sheetIsOpen = () => openSheets.length > 0;

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openSheets.length) {
    event.preventDefault();
    openSheets[openSheets.length - 1].close();
  }
});

// A bottom sheet over a dimmed backdrop. Closes from the X, the backdrop, Escape, or dragging the handle down.
export function openSheet({ className, label, content, onClose }: SheetOptions): Sheet {
  const previousFocus = document.activeElement as HTMLElement | null;
  const handle = h('div', { class: 'sheet__grabber' }, h('span', { class: 'sheet__handle' }));
  const closeButton = h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Close' }, icon('close', 20));
  const panel = h('div', { class: cx('sheet__panel', className), role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' }, handle, closeButton, content);
  const backdrop = h('div', { class: 'sheet__backdrop' });
  const root = h('div', { class: 'sheet' }, backdrop, panel);

  let closed = false;
  const sheet: Sheet = {
    panel,
    close: () => {
      if (closed) return;
      closed = true;
      openSheets.splice(openSheets.indexOf(sheet), 1);
      root.classList.remove('sheet--open');
      panel.style.transform = '';
      setTimeout(() => root.remove(), CLOSE_MS);
      document.body.classList.toggle('has-sheet', openSheets.length > 0);
      previousFocus?.focus({ preventScroll: true });
      onClose?.();
    },
  };

  backdrop.addEventListener('click', sheet.close);
  closeButton.addEventListener('click', sheet.close);

  // Dragging the handle down moves the sheet with the pointer; letting go far enough closes it
  let dragStart: number | null = null;
  handle.addEventListener('pointerdown', (event) => {
    dragStart = event.clientY;
    handle.setPointerCapture(event.pointerId);
    panel.classList.add('sheet__panel--dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (dragStart === null) return;
    panel.style.transform = `translateY(${Math.max(0, event.clientY - dragStart)}px)`;
  });
  const endDrag = (event: PointerEvent) => {
    if (dragStart === null) return;
    const distance = event.clientY - dragStart;
    dragStart = null;
    panel.classList.remove('sheet__panel--dragging');
    // A plain tap on the handle also closes, like the native grabber
    if (distance > DISMISS_DISTANCE || Math.abs(distance) < 4) sheet.close();
    else panel.style.transform = '';
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  document.body.append(root);
  document.body.classList.add('has-sheet');
  openSheets.push(sheet);
  afterPaint(() => {
    root.classList.add('sheet--open');
    panel.focus({ preventScroll: true });
  });
  return sheet;
}
