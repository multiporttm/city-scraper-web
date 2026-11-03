import { h } from '@/web/dom';
import { signIn } from '@/web/state';

export function signInScreen() {
  const input = h('input', {
    class: 'auth-screen__input',
    name: 'given-name',
    placeholder: 'First name',
    autocomplete: 'given-name',
    autocapitalize: 'words',
    spellcheck: 'false',
    'aria-label': 'First name',
    required: true,
  });
  const button = h('button', { class: 'primary-button', type: 'submit', disabled: true }, 'Continue');
  input.addEventListener('input', () => (button.disabled = !input.value.trim()));

  const form = h(
    'form',
    {
      class: 'auth-screen__form',
      onsubmit: (event: SubmitEvent) => {
        event.preventDefault();
        const name = input.value.trim();
        if (name) signIn(name);
      },
    },
    input,
    button,
  );

  const screen = h(
    'main',
    { class: 'auth-screen' },
    h(
      'div',
      { class: 'auth-screen__hero' },
      h('h1', { class: 'auth-screen__title' }, 'Find your next event'),
      h('p', { class: 'auth-screen__subtitle' }, 'Enter your name and preferences to receive event recommendations'),
    ),
    form,
  );
  requestAnimationFrame(() => input.focus());
  return screen;
}
