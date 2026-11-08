import type { PreferenceFormId } from '@/types/preferences';

export type QuizStep = {
  // 'about' is the optional age and gender step; the others are the preference forms
  id: PreferenceFormId | 'about';
  title: string;
  subtitle: string;
};

export const QUIZ_STEPS: QuizStep[] = [
  { id: 'about', title: 'Tell us about you', subtitle: 'Helps us skip events you can’t go to and find ones made for you' },
  { id: 'location', title: 'Where are you based?', subtitle: 'Pick your city and how far you would travel for an event' },
  { id: 'availability', title: 'When are you free?', subtitle: 'Choose the days and times that work for you' },
  { id: 'interests', title: 'What are you into?', subtitle: 'Tap the topics you want to see events for. More will appear as you go' },
];
