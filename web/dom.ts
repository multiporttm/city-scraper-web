type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

// Small element builder: h('button', { class: 'chip', onclick: toggle }, 'Music').
// `on…` props become event listeners, `class` sets the class name, anything else is an attribute.
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: (Child | Child[])[]) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value as EventListener);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  append(element, children);
  return element;
}

export function append(parent: Element, children: (Child | Child[])[]) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(typeof child === 'number' ? String(child) : child);
  }
}

// Swaps an element's children for new ones
export function replaceChildren(parent: Element, ...children: (Child | Child[])[]) {
  parent.replaceChildren();
  append(parent, children);
}

// Joins class names, skipping falsy ones: cx('chip', selected && 'chip--selected')
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

// A PNG from public/images drawn in the current text color, like React Native's tintColor
export const tintedImage = (name: string, className = 'tinted') =>
  h('span', { class: className, 'aria-hidden': 'true', style: `--image: url(/images/${name}.png)` });

// Runs `next` once the browser has painted the current state, so a CSS transition can start from it
export const afterPaint = (next: () => void) => requestAnimationFrame(() => requestAnimationFrame(next));
