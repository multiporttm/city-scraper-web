import { PREFERENCE_FORMS } from '@/data/preferences';
import { aboutBlocker, aboutInputs, parseAge, type AboutValues } from '@/web/components/aboutInputs';
import { blockerFor, PREFERENCE_INPUTS } from '@/web/components/preferenceInputs';
import { openSheet, type Sheet } from '@/web/components/sheet';
import { cx, h, tintedImage } from '@/web/dom';
import { icon } from '@/web/icons';
import { preferences, profile, signOut } from '@/web/state';
import type { TabScreen } from '@/web/screens/types';
import type { PreferenceFormId } from '@/types/preferences';

type SettingsItem = { label: string; image: string; iconClass: string; form: PreferenceFormId };

const PREFERENCE_ITEMS: SettingsItem[] = [
  { label: 'Location & Distance', image: 'location', iconClass: 'settings-row__icon--blue', form: 'location' },
  { label: 'Availability', image: 'availability', iconClass: 'settings-row__icon--violet', form: 'availability' },
  { label: 'Interests', image: 'interests', iconClass: 'settings-row__icon--pink', form: 'interests' },
];

const chevron = () => icon('chevron-forward', 18, 'icon settings-row__chevron');

// Edits one preference form in a sheet. Changes are a draft until saved; closing discards them.
function openPreferencesSheet(formId: PreferenceFormId) {
  const form = PREFERENCE_FORMS[formId];
  const saved = preferences.get();
  let draft = { ...saved };
  let sheet: Sheet | null = null;

  const save = h('button', { class: 'primary-button sheet__save', type: 'button' });
  const update = () => {
    const blocker = blockerFor(formId, draft);
    const changed = form.fields.some((field) => draft[field.key] !== saved[field.key]);
    save.disabled = blocker !== null || !changed;
    save.textContent = blocker ?? 'Save';
    save.classList.toggle('sheet__save--hidden', blocker === null && !changed);
  };
  save.addEventListener('click', () => {
    if (save.disabled) return;
    preferences.set(draft);
    sheet?.close();
  });

  const content = h(
    'div',
    { class: cx('preferences-sheet', `preferences-sheet--${formId}`) },
    h('h2', { class: 'sheet__title' }, form.title),
    h('p', { class: 'sheet__subtitle' }, form.subtitle),
    h(
      'div',
      { class: 'preferences-sheet__body' },
      PREFERENCE_INPUTS[formId](draft, (values) => {
        draft = { ...draft, ...values };
        update();
      }),
    ),
    save,
  );
  update();
  sheet = openSheet({ className: 'edit-sheet', label: form.title, content });
}

// Name, age and gender. Age and gender are optional and only fine-tune which events show up.
function openProfileSheet() {
  let sheet: Sheet | null = null;
  const saved = profile.get();
  let about: AboutValues = { age: saved.age?.toString() ?? '', gender: saved.gender };
  const input = h('input', { class: 'editable-field__input', id: 'name-input', value: saved.name, autocomplete: 'given-name', autocapitalize: 'words', spellcheck: 'false' });
  const save = h('button', { class: 'primary-button sheet__save', type: 'submit' }, 'Save');
  const update = () => {
    const name = input.value.trim();
    const blocker = name ? aboutBlocker(about) : 'Enter a name';
    const changed = name !== saved.name || parseAge(about.age) !== saved.age || about.gender !== saved.gender;
    save.disabled = blocker !== null || !changed;
    save.textContent = blocker ?? 'Save';
    save.classList.toggle('sheet__save--hidden', blocker === null && !changed);
  };
  input.addEventListener('input', update);

  const content = h(
    'form',
    {
      class: 'preferences-sheet',
      onsubmit: (event: SubmitEvent) => {
        event.preventDefault();
        if (save.disabled) return;
        profile.set({ name: input.value.trim(), age: parseAge(about.age), gender: about.gender });
        sheet?.close();
      },
    },
    h('h2', { class: 'sheet__title' }, 'Edit Profile'),
    h('p', { class: 'sheet__subtitle' }, 'Your name, and optionally your age and gender'),
    h('div', { class: 'settings-section__card preferences-sheet__body' }, h('label', { class: 'editable-field', for: 'name-input' }, h('span', { class: 'editable-field__label' }, 'Name'), input)),
    h(
      'div',
      { class: 'profile-sheet__about' },
      aboutInputs(about, (values) => {
        about = { ...about, ...values };
        update();
      }),
    ),
    save,
  );
  update();
  sheet = openSheet({ className: 'edit-sheet', label: 'Edit Profile', content });
}

export function settingsScreen(): TabScreen {
  const initial = h('span', { class: 'profile-card__initial' });
  const name = h('span', { class: 'profile-card__name' });
  const renderProfile = () => {
    const current = profile.get().name;
    initial.textContent = current.charAt(0).toUpperCase();
    name.textContent = current;
  };
  profile.subscribe(renderProfile);
  renderProfile();

  const element = h(
    'main',
    { class: 'tab-screen settings-screen' },
    h(
      'div',
      { class: 'tab-screen__content' },
      h('header', { class: 'screen-header' }, h('h1', { class: 'screen-header__title' }, 'Settings'), h('p', { class: 'screen-header__subtitle' }, 'Update your preferences')),
      h(
        'section',
        { class: 'settings-section__card profile-card' },
        h('div', { class: 'profile-card__header' }, h('span', { class: 'profile-card__avatar' }, initial), name),
        h('button', { class: 'settings-row settings-row--plain', type: 'button', onclick: openProfileSheet }, h('span', { class: 'settings-row__label' }, 'Edit Profile'), chevron()),
      ),
      h(
        'section',
        { class: 'settings-section' },
        h('h2', { class: 'settings-section__title' }, 'Preferences'),
        h(
          'div',
          { class: 'settings-section__card' },
          PREFERENCE_ITEMS.map((item) =>
            h(
              'button',
              { class: 'settings-row', type: 'button', onclick: () => openPreferencesSheet(item.form) },
              h('span', { class: cx('settings-row__icon', item.iconClass) }, tintedImage(item.image)),
              h('span', { class: 'settings-row__label' }, item.label),
              chevron(),
            ),
          ),
        ),
      ),
      h('button', { class: 'settings-screen__sign-out', type: 'button', onclick: signOut }, 'Sign out'),
    ),
  );

  return { element, show: () => {}, hide: () => {} };
}
