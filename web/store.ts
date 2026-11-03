type Listener = () => void;

export type Store<T> = {
  get: () => T;
  set: (next: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: Listener) => () => void;
};

type PersistOptions<T> = {
  // localStorage key
  key: string;
  // Bump when the saved shape changes; older saves are dropped
  version: number;
  // Which fields to save (all by default)
  pick?: (state: T) => Partial<T>;
};

// localStorage can be missing or throw (private windows, blocked storage), so the app keeps working without it
function load<T>(key: string, version: number): Partial<T> | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { version: number; state: Partial<T> } | null;
    return saved && saved.version === version ? saved.state : null;
  } catch {
    return null;
  }
}

function save(key: string, version: number, state: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ version, state }));
  } catch {
    // Storage is full or blocked; the state still lives in memory
  }
}

// A tiny Zustand-style store: get, set (shallow merge) and subscribe, optionally saved to localStorage.
export function createStore<T extends object>(initial: T, persist?: PersistOptions<T>): Store<T> {
  let state: T = persist ? { ...initial, ...load<T>(persist.key, persist.version) } : initial;
  const listeners = new Set<Listener>();

  return {
    get: () => state,
    set: (next) => {
      const patch = typeof next === 'function' ? next(state) : next;
      if (patch === state) return;
      state = { ...state, ...patch };
      if (persist) save(persist.key, persist.version, persist.pick ? persist.pick(state) : state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
