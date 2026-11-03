// A tab's screen stays in the page while other tabs are shown, so it keeps its state (like the map position)
export type TabScreen = {
  element: HTMLElement;
  show: () => void;
  hide: () => void;
};
