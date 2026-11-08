import { QUIZ_STEPS } from '@/data/quiz';
import { aboutBlocker, aboutInputs, parseAge, type AboutValues } from '@/web/components/aboutInputs';
import { blockerFor, PREFERENCE_INPUTS } from '@/web/components/preferenceInputs';
import { cx, h, replaceChildren } from '@/web/dom';
import { completeOnboarding, profile } from '@/web/state';
import type { PreferenceValues } from '@/types/preferences';

// Starts blank so nothing is pre-selected, except a sensible distance and evening hours
const INITIAL_ANSWERS: PreferenceValues = {
  location: '',
  distance: '5',
  days: '',
  times: '6:00 PM - 10:00 PM',
  interests: '',
};

// The onboarding quiz: about you (optional age and gender), location and distance, availability, interests.
export function quizScreen() {
  let stepIndex = 0;
  let answers = { ...INITIAL_ANSWERS };
  let about: AboutValues = { age: profile.get().age?.toString() ?? '', gender: profile.get().gender };
  const screen = h('main', { class: 'quiz-screen' });

  const progress = h('div', { class: 'quiz-progress' });
  const back = h('button', { class: 'link-button quiz-screen__back', type: 'button' }, 'Back');
  const count = h('span', { class: 'quiz-screen__count' });
  const title = h('h1', { class: 'screen-header__title' });
  const subtitle = h('p', { class: 'screen-header__subtitle' });
  const body = h('div', { class: 'quiz-screen__body' });
  const button = h('button', { class: 'primary-button quiz-screen__button', type: 'button' });

  const updateButton = () => {
    const step = QUIZ_STEPS[stepIndex];
    const blocker = step.id === 'about' ? aboutBlocker(about) : blockerFor(step.id, answers);
    button.disabled = blocker !== null;
    button.textContent = blocker ?? (stepIndex === QUIZ_STEPS.length - 1 ? 'Finish' : 'Continue');
  };

  const showStep = () => {
    const step = QUIZ_STEPS[stepIndex];
    replaceChildren(
      progress,
      QUIZ_STEPS.map((_, i) => h('span', { class: cx('quiz-progress__bar', i <= stepIndex && 'quiz-progress__bar--done') })),
    );
    back.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    count.textContent = `${stepIndex + 1} of ${QUIZ_STEPS.length}`;
    title.textContent = step.title;
    subtitle.textContent = step.subtitle;
    // Each step starts fresh, built from the answers so far
    replaceChildren(
      body,
      step.id === 'about'
        ? aboutInputs(about, (values) => {
            about = { ...about, ...values };
            updateButton();
          })
        : PREFERENCE_INPUTS[step.id](answers, (values) => {
            answers = { ...answers, ...values };
            updateButton();
          }),
    );
    updateButton();
    screen.scrollTo({ top: 0 });
  };

  back.addEventListener('click', () => {
    if (stepIndex === 0) return;
    stepIndex -= 1;
    showStep();
  });
  button.addEventListener('click', () => {
    if (button.disabled) return;
    if (stepIndex < QUIZ_STEPS.length - 1) {
      stepIndex += 1;
      showStep();
    } else {
      profile.set({ age: parseAge(about.age), gender: about.gender });
      completeOnboarding(answers);
    }
  });

  screen.append(
    h(
      'div',
      { class: 'quiz-screen__inner' },
      progress,
      h('div', { class: 'quiz-screen__top' }, back, count),
      h('header', { class: 'screen-header quiz-screen__header' }, title, subtitle),
      body,
      h('div', { class: 'quiz-screen__footer' }, button),
    ),
  );
  showStep();
  return screen;
}
