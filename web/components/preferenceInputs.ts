import { DAYS, DISTANCE_MAX, DISTANCE_MIN, DISTANCE_STEP, INTEREST_OPTIONS, RELATED_INTERESTS } from '@/data/preferences';
import { searchCities, type CitySuggestion } from '@/lib/cities';
import { formatRanges, hasEmptySlotDays, parseRanges, type Time, type TimeRange } from '@/lib/times';
import { cx, h, replaceChildren } from '@/web/dom';
import type { PreferenceFormId, PreferenceValues } from '@/types/preferences';

type Change = (values: Partial<PreferenceValues>) => void;

// What still has to be filled in before a form can be saved, or null when it's ready.
// Same rules in the quiz and the settings sheets: a city, at least one day, and at least one interest.
export function blockerFor(formId: PreferenceFormId, values: PreferenceValues) {
  return {
    location: values.location ? null : 'Select a suggested city',
    availability: values.days.trim() && !hasEmptySlotDays(values.times) ? null : 'Select a day',
    interests: values.interests.trim() ? null : 'Select an interest',
  }[formId];
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/* Location */

const SEARCH_DEBOUNCE_MS = 120;

// A city field with live suggestions and the commute distance slider. Only a city picked from the
// suggestions counts as the answer, so the location is '' while the user is typing.
export function locationInputs(values: PreferenceValues, onChange: Change) {
  let location = values.location;
  let suggestions: CitySuggestion[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const input = h('input', {
    class: 'editable-field__input',
    id: 'location-input',
    value: location,
    placeholder: 'Enter a city',
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-controls': 'city-suggestions',
    'aria-expanded': 'false',
  });
  const list = h('div', { class: 'city-suggestions', id: 'city-suggestions', role: 'listbox', hidden: true });

  const renderSuggestions = () => {
    list.hidden = suggestions.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    replaceChildren(
      list,
      suggestions.map((city) => {
        const selected = city.label === location;
        return h(
          'button',
          {
            class: cx('city-suggestion', selected && 'city-suggestion--selected'),
            type: 'button',
            role: 'option',
            'aria-selected': String(selected),
            onclick: () => {
              location = city.label;
              input.value = city.label;
              onChange({ location });
              renderSuggestions();
            },
          },
          h('span', { class: 'city-suggestion__name' }, city.label),
          h('span', { class: 'city-suggestion__detail' }, city.detail),
        );
      }),
    );
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (location) {
      location = '';
      onChange({ location });
    }
    clearTimeout(timer);
    controller?.abort();
    if (!query) {
      suggestions = [];
      renderSuggestions();
      return;
    }
    timer = setTimeout(() => {
      controller = new AbortController();
      searchCities(query, controller.signal)
        .then((found) => {
          suggestions = found;
          renderSuggestions();
        })
        // Offline or replaced by a newer search: keep whatever is shown
        .catch(() => {});
    }, SEARCH_DEBOUNCE_MS);
  });

  // Enter picks the first suggestion
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && suggestions[0]) {
      event.preventDefault();
      (list.firstElementChild as HTMLButtonElement | null)?.click();
    }
  });

  return h(
    'div',
    { class: 'location-inputs' },
    h(
      'div',
      { class: 'settings-section__card' },
      h('label', { class: 'editable-field', for: 'location-input' }, h('span', { class: 'editable-field__label' }, 'Location'), input),
    ),
    distanceSlider(values.distance, (distance) => onChange({ distance })),
    list,
  );
}

function distanceSlider(value: string, onChange: (value: string) => void) {
  const initial = Math.min(DISTANCE_MAX, Math.max(DISTANCE_MIN, Number(value) || DISTANCE_MIN));
  const label = h('span', { class: 'distance-slider__value' });
  const range = h('input', {
    class: 'distance-slider__input',
    type: 'range',
    id: 'distance-input',
    min: DISTANCE_MIN,
    max: DISTANCE_MAX,
    step: DISTANCE_STEP,
    value: initial,
  });
  const show = () => {
    const miles = Number(range.value);
    label.textContent = `${miles} miles`;
    range.style.setProperty('--fill', `${((miles - DISTANCE_MIN) / (DISTANCE_MAX - DISTANCE_MIN)) * 100}%`);
  };
  range.addEventListener('input', () => {
    show();
    onChange(range.value);
  });
  show();

  return h(
    'div',
    { class: 'distance-slider' },
    h('label', { class: 'distance-slider__header', for: 'distance-input' }, h('span', { class: 'distance-slider__label' }, 'Distance'), label),
    range,
    h(
      'div',
      { class: 'distance-slider__range' },
      h('span', { class: 'distance-slider__range-label' }, `${DISTANCE_MIN} mi`),
      h('span', { class: 'distance-slider__range-label' }, `${DISTANCE_MAX} mi`),
    ),
  );
}

/* Availability */

// Seven day toggles. Dragging across them paints every day passed over, using the first day's state:
// starting on an unselected day selects the swept days, starting on a selected one clears them.
// Days are stored as a comma-separated string, always in week order (e.g. "Fri, Sat, Sun").
function dayPicker(value: string, onChange: (value: string) => void, label: string) {
  let selected = splitList(value);
  const buttons = DAYS.map((day) => h('button', { class: 'day-picker__day', type: 'button', 'aria-pressed': 'false', 'data-day': day }, day));
  const root = h('div', { class: 'day-picker', role: 'group', 'aria-label': label }, buttons);

  const render = () => {
    buttons.forEach((button, i) => {
      const on = selected.includes(DAYS[i]);
      const prevOn = i > 0 && selected.includes(DAYS[i - 1]);
      const nextOn = i < DAYS.length - 1 && selected.includes(DAYS[i + 1]);
      button.className = cx(
        'day-picker__day',
        on && 'day-picker__day--selected',
        on && !prevOn && 'day-picker__day--start',
        on && !nextOn && 'day-picker__day--end',
      );
      button.setAttribute('aria-pressed', String(on));
    });
  };
  const emit = (days: string[]) => {
    const next = DAYS.filter((day) => days.includes(day));
    if (next.join(', ') === selected.join(', ')) return;
    selected = next;
    render();
    onChange(next.join(', '));
  };

  let swipe: { from: number; base: string[]; adding: boolean } | null = null;
  const indexAt = (x: number) => {
    const box = root.getBoundingClientRect();
    return Math.min(DAYS.length - 1, Math.max(0, Math.floor(((x - box.left) / box.width) * DAYS.length)));
  };
  const paint = (to: number) => {
    if (!swipe) return;
    const swept = DAYS.slice(Math.min(swipe.from, to), Math.max(swipe.from, to) + 1);
    emit(swipe.adding ? [...swipe.base, ...swept] : swipe.base.filter((day) => !swept.includes(day)));
  };
  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const from = indexAt(event.clientX);
    swipe = { from, base: selected, adding: !selected.includes(DAYS[from]) };
    root.setPointerCapture(event.pointerId);
    paint(from);
  });
  root.addEventListener('pointermove', (event) => paint(indexAt(event.clientX)));
  const end = () => (swipe = null);
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  // Keyboard presses arrive as clicks with no pointer behind them
  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (event.detail !== 0 || !button) return;
    const day = button.dataset.day!;
    emit(selected.includes(day) ? selected.filter((item) => item !== day) : [...selected, day]);
  });

  render();
  return root;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_STEP = 15;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const SLOTS = [
  { key: 'start', label: 'From' },
  { key: 'end', label: 'Until' },
] as const;
type SlotKey = (typeof SLOTS)[number]['key'];

const formatTime = ({ hour, minute, period }: Time) => `${hour}:${String(minute).padStart(2, '0')} ${period}`;

const addHour = ({ hour, minute, period }: Time): Time => {
  const next = ((hour % 12) + (period === 'PM' ? 12 : 0) + 1) % 24;
  return { hour: next % 12 || 12, minute, period: next >= 12 ? 'PM' : 'AM' };
};

// Hour, minute and AM/PM selects for one end of a timeslot, like the app's time wheels
function timeSelects(time: Time, label: string, onChange: (time: Time) => void) {
  const select = (name: string, options: (string | number)[], current: string | number, update: (value: string) => Time) => {
    const element = h(
      'select',
      { class: 'time-range__select', 'aria-label': `${label} ${name}` },
      options.map((option) => h('option', { value: option, selected: String(option) === String(current) }, typeof option === 'number' && name === 'minute' ? String(option).padStart(2, '0') : option)),
    );
    element.addEventListener('change', () => onChange(update(element.value)));
    return element;
  };
  // Keep a saved minute that isn't on the 15-minute grid selectable
  const minutes = MINUTES.includes(time.minute) ? MINUTES : [...MINUTES, time.minute].sort((a, b) => a - b);
  return h(
    'div',
    { class: 'time-range__selects' },
    select('hour', HOURS, time.hour, (value) => ({ ...time, hour: Number(value) })),
    h('span', { class: 'time-range__colon' }, ':'),
    select('minute', minutes, time.minute, (value) => ({ ...time, minute: Number(value) })),
    select('period', ['AM', 'PM'], time.period, (value) => ({ ...time, period: value as Time['period'] })),
  );
}

// The main days plus one or more From/Until timeslots. Extra slots carry their own days,
// stored as "6:00 PM - 10:00 PM; Sat, Sun: 1:00 PM - 3:00 PM".
export function availabilityInputs(values: PreferenceValues, onChange: Change) {
  let days = values.days;
  let ranges = parseRanges(values.times);
  // The tile whose time selects are showing
  let open: { index: number; key: SlotKey } | null = null;
  const slotsRoot = h('div', { class: 'time-range' });

  const setRanges = (next: TimeRange[]) => {
    ranges = next;
    onChange({ times: formatRanges(ranges) });
    render();
  };
  const updateRange = (index: number, patch: Partial<TimeRange>) => setRanges(ranges.map((range, i) => (i === index ? { ...range, ...patch } : range)));

  const addSlot = () => {
    const start = ranges[ranges.length - 1].end;
    // New slots default to the days the main days don't cover
    const taken = splitList(days);
    const free = DAYS.filter((day) => !taken.includes(day));
    open = null;
    setRanges([...ranges, { start, end: addHour(start), days: (free.length ? free : ['Sat', 'Sun']).join(', ') }]);
  };

  const render = () => {
    replaceChildren(
      slotsRoot,
      ranges.map((range, index) =>
        h(
          'div',
          { class: cx('time-range__row', index > 0 && 'time-range__row--extra') },
          index > 0 && dayPicker(range.days ?? '', (value) => updateRange(index, { days: value }), `Days for timeslot ${index + 1}`),
          h(
            'div',
            { class: 'time-range__slots' },
            SLOTS.map(({ key, label }) => {
              const isOpen = open?.index === index && open.key === key;
              return h(
                'button',
                {
                  class: cx('time-range__slot', isOpen && 'time-range__slot--open'),
                  type: 'button',
                  'aria-expanded': String(isOpen),
                  onclick: () => {
                    open = isOpen ? null : { index, key };
                    render();
                  },
                },
                h('span', { class: 'time-range__slot-label' }, label),
                h('span', { class: 'time-range__slot-time' }, formatTime(range[key])),
              );
            }),
          ),
          open?.index === index &&
            timeSelects(range[open.key], SLOTS.find((slot) => slot.key === open!.key)!.label, (time) => updateRange(index, { [open!.key]: time })),
          index > 0 &&
            h(
              'div',
              { class: 'time-range__remove' },
              h(
                'button',
                {
                  class: 'link-button',
                  type: 'button',
                  onclick: () => {
                    open = null;
                    setRanges(ranges.filter((_, i) => i !== index));
                  },
                },
                'Remove',
              ),
            ),
        ),
      ),
      h('div', { class: 'time-range__add' }, h('button', { class: 'link-button', type: 'button', onclick: addSlot }, 'Add a new timeslot')),
    );
  };
  render();

  return h(
    'div',
    { class: 'availability-inputs' },
    dayPicker(
      days,
      (value) => {
        days = value;
        onChange({ days });
      },
      'Days',
    ),
    slotsRoot,
  );
}

/* Interests */

const SUGGESTIONS_PER_PICK = 2;

// Capsule chips for the interest taxonomy. Picking one adds a couple of related interests right after it.
export function interestInputs(values: PreferenceValues, onChange: Change) {
  let selected = splitList(values.interests);
  // Keep interests saved from outside the list visible, so they can still be removed
  let options = [...INTEREST_OPTIONS, ...selected.filter((interest) => !INTEREST_OPTIONS.includes(interest))];
  const root = h('div', { class: 'interest-chips', role: 'group', 'aria-label': 'Interests' });
  // Only chips added after opening animate in
  const fresh = new Set<string>();

  const toggle = (interest: string) => {
    if (selected.includes(interest)) {
      selected = selected.filter((item) => item !== interest);
    } else {
      selected = [...selected, interest];
      const related = (RELATED_INTERESTS[interest] ?? []).filter((item) => !options.includes(item)).slice(0, SUGGESTIONS_PER_PICK);
      const at = options.indexOf(interest) + 1;
      options = [...options.slice(0, at), ...related, ...options.slice(at)];
      related.forEach((item) => fresh.add(item));
    }
    onChange({ interests: selected.join(', ') });
    render();
  };

  const render = () => {
    replaceChildren(
      root,
      options.map((interest) => {
        const isSelected = selected.includes(interest);
        const chip = h(
          'button',
          {
            class: cx('interest-chip', isSelected && 'interest-chip--selected', fresh.has(interest) && 'interest-chip--new'),
            type: 'button',
            'aria-pressed': String(isSelected),
            onclick: () => toggle(interest),
          },
          interest,
        );
        return chip;
      }),
    );
    // Animate each new chip once
    fresh.clear();
  };
  render();
  return root;
}

export const PREFERENCE_INPUTS: Record<PreferenceFormId, (values: PreferenceValues, onChange: Change) => HTMLElement> = {
  location: locationInputs,
  availability: availabilityInputs,
  interests: interestInputs,
};
