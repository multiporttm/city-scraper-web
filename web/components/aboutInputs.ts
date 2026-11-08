import { GENDER_OPTIONS, MAX_AGE, MIN_AGE, type Gender } from '@/lib/personalize';
import { cx, h, replaceChildren } from '@/web/dom';

// The age field's text as typed, so a half-typed or invalid age can be flagged instead of lost
export type AboutValues = { age: string; gender: Gender | null };

export const parseAge = (text: string) => {
  const age = Number(text.trim());
  return text.trim() && Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE ? age : null;
};

// Both are optional; only an age that isn't a real one holds up saving
export const aboutBlocker = ({ age }: AboutValues) =>
  age.trim() && parseAge(age) === null ? `Enter an age from ${MIN_AGE} to ${MAX_AGE}` : null;

const PREFER_NOT = 'Prefer not to say';

// Age and gender, used only to match events aimed at an age or gender (21+, "ages 25-35", women's run clubs...)
export function aboutInputs(values: AboutValues, onChange: (values: Partial<AboutValues>) => void) {
  let gender = values.gender;
  const age = h('input', {
    class: 'editable-field__input',
    id: 'age-input',
    type: 'number',
    inputmode: 'numeric',
    min: MIN_AGE,
    max: MAX_AGE,
    placeholder: 'Optional',
    value: values.age,
  });
  age.addEventListener('input', () => onChange({ age: age.value }));

  const chips = h('div', { class: 'about-inputs__genders', role: 'radiogroup', 'aria-label': 'Gender' });
  const renderChips = () =>
    replaceChildren(
      chips,
      [...GENDER_OPTIONS, { value: null, label: PREFER_NOT }].map((option) =>
        h(
          'button',
          {
            class: cx('interest-chip', gender === option.value && 'interest-chip--selected'),
            type: 'button',
            role: 'radio',
            'aria-checked': String(gender === option.value),
            onclick: () => {
              gender = option.value;
              onChange({ gender });
              renderChips();
            },
          },
          option.label,
        ),
      ),
    );
  renderChips();

  return h(
    'div',
    { class: 'about-inputs' },
    h('div', { class: 'settings-section__card' }, h('label', { class: 'editable-field', for: 'age-input' }, h('span', { class: 'editable-field__label' }, 'Age'), age)),
    h('h3', { class: 'about-inputs__label' }, 'Gender'),
    chips,
    h(
      'p',
      { class: 'about-inputs__hint' },
      'Optional. Only used to match events aimed at an age or gender, like 21+ nights or women’s run clubs. It stays on this device.',
    ),
  );
}
