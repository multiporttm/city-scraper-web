type SwipeOptions = {
  // Leave out to allow only left swipes (the Pinned list, where cards sit in a vertical scroll)
  onSwipeRight?: () => void;
  onSwipeLeft: () => void;
  onPress?: () => void;
  // -1 (archive) .. 1 (pin) drag progress, for the screen's colour wash
  onProgress?: (progress: number, animate: boolean) => void;
  // Red panel revealed behind a left-only card as it slides away
  archivePanel?: HTMLElement;
};

export type Swipeable = { fling: (direction: 'left' | 'right') => void };

// Kept low so the stack can be swiped through quickly: a short flick commits.
const FLING_VELOCITY = 0.45; // px per ms
const EXIT_MS = 160;
const LEFT_ONLY_FLING_VELOCITY = 0.25;
const LEFT_ONLY_EXIT_MS = 100;
const LEFT_ONLY_THRESHOLD_RATIO = 0.12;
const THRESHOLD_RATIO = 0.22;
const ACTIVATION_PX = 8;
const TAP_SLOP_PX = 6;
const ARCHIVE_GAP = 10;
// Desktop windows are wide, so the swipe distances are measured against a phone-sized width
const MAX_SWIPE_WIDTH = 480;

// Lets a card be dragged sideways with a mouse or finger: right pins, left archives, a tap presses.
export function makeSwipeable(card: HTMLElement, { onSwipeRight, onSwipeLeft, onPress, onProgress, archivePanel }: SwipeOptions): Swipeable {
  const canSwipeRight = !!onSwipeRight;
  const width = () => Math.min(window.innerWidth, MAX_SWIPE_WIDTH);
  const threshold = () => width() * (canSwipeRight ? THRESHOLD_RATIO : LEFT_ONLY_THRESHOLD_RATIO);
  const flingVelocity = canSwipeRight ? FLING_VELOCITY : LEFT_ONLY_FLING_VELOCITY;
  const exitMs = canSwipeRight ? EXIT_MS : LEFT_ONLY_EXIT_MS;

  let start: { x: number; y: number } | null = null;
  let active = false;
  let done = false;
  let x = 0;
  // Recent pointer positions, for the release velocity
  let samples: { x: number; t: number }[] = [];

  const setX = (next: number, transitionMs = 0, easing = 'ease-out') => {
    x = next;
    card.style.transition = transitionMs ? `transform ${transitionMs}ms ${easing}` : 'none';
    // Left-only cards slide flat so the archive panel's edge stays parallel to the card
    const rotate = canSwipeRight ? (x / width()) * 6 : 0;
    card.style.transform = x ? `translateX(${x}px) rotate(${rotate}deg)` : '';
    if (archivePanel) {
      const revealed = Math.max(0, -x - ARCHIVE_GAP);
      archivePanel.style.transition = card.style.transition.replace('transform', 'width');
      archivePanel.style.width = `${revealed}px`;
      archivePanel.style.opacity = String(Math.min(1, revealed / 56));
    }
  };

  const exit = (direction: 'left' | 'right') => {
    if (done) return;
    done = true;
    setX((direction === 'right' ? 1 : -1) * width() * 1.5, exitMs, 'ease-in');
    onProgress?.(0, true);
    setTimeout(direction === 'right' ? onSwipeRight! : onSwipeLeft, exitMs);
  };

  const settle = () => {
    setX(0, 260, 'cubic-bezier(0.2, 0.9, 0.3, 1.2)');
    onProgress?.(0, true);
  };

  card.addEventListener('pointerdown', (event) => {
    if (done || (event.pointerType === 'mouse' && event.button !== 0)) return;
    start = { x: event.clientX, y: event.clientY };
    active = false;
    samples = [{ x: event.clientX, t: event.timeStamp }];
  });

  card.addEventListener('pointermove', (event) => {
    if (!start || done) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!active) {
      // Mostly vertical drags scroll the page instead
      if (Math.abs(dx) < ACTIVATION_PX || Math.abs(dx) < Math.abs(dy)) return;
      if (!canSwipeRight && dx > 0) return;
      active = true;
      card.setPointerCapture(event.pointerId);
      card.classList.add('is-dragging');
    }
    samples = [...samples.slice(-4), { x: event.clientX, t: event.timeStamp }];
    const next = canSwipeRight ? dx : Math.min(0, dx);
    setX(next);
    onProgress?.(Math.max(-1, Math.min(1, next / threshold())), false);
  });

  card.addEventListener('pointerup', (event) => {
    if (!start || done) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    start = null;
    card.classList.remove('is-dragging');
    if (!active) {
      if (moved < TAP_SLOP_PX) onPress?.();
      return;
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const toRight = canSwipeRight && (x > threshold() || (velocity > flingVelocity && x > 20));
    const toLeft = x < -threshold() || (velocity < -flingVelocity && x < -20);
    if (toRight) exit('right');
    else if (toLeft) exit('left');
    else settle();
  });

  card.addEventListener('pointercancel', () => {
    if (!start || done) return;
    start = null;
    card.classList.remove('is-dragging');
    if (active) settle();
  });

  // Keyboard users press the card like a button
  card.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !done) {
      event.preventDefault();
      onPress?.();
    }
  });

  return { fling: exit };
}
