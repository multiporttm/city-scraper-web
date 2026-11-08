import type { EventItem } from '@/types/events';

// Personal adjustments to the server's ranking, made in the browser so age and gender never leave the device.
//
// Age and gender only act on events that explicitly target them (21+, "ages 25-35", "women's run club",
// "for dads"...). They never guess someone's interests: a woman isn't shown more fashion events,
// a man isn't shown more sports. Interests come from the quiz and from what the user pins or archives.

export type Gender = 'woman' | 'man' | 'nonbinary';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
];

export const MIN_AGE = 13;
export const MAX_AGE = 120;

export type PersonalProfile = {
  age: number | null;
  gender: Gender | null;
};

// What the user has shown they like (positive) or skip (negative), learned from pins and archives
export type Taste = {
  categories: Record<string, number>;
  hosts: Record<string, number>;
};

export const EMPTY_TASTE: Taste = { categories: {}, hosts: {} };

// How much each action teaches. Unpinning first takes back the pin, then counts a little against it.
export const TASTE_WEIGHTS = { pin: 1, archive: -0.5, unpin: -1.3 };

// The most the learned taste can move an event, on the server's scale (interest match = 100, closeness ≤ 30)
const MAX_CATEGORY_BOOST = 25;
const MAX_HOST_BOOST = 15;

const hostKey = (event: Pick<EventItem, 'host'>) => event.host.trim().toLowerCase();

// Adds one pin/archive to the taste. Returns a new object, so it can go straight into a store.
export function learnTaste(taste: Taste, event: Pick<EventItem, 'category' | 'host'>, weight: number): Taste {
  const add = (counts: Record<string, number>, key: string) => {
    if (!key) return counts;
    const next = Math.round(((counts[key] ?? 0) + weight) * 100) / 100;
    const { [key]: _old, ...rest } = counts;
    return next === 0 ? rest : { ...rest, [key]: next };
  };
  // "Other" says nothing about what the user likes
  const categories = event.category === 'Other' ? taste.categories : add(taste.categories, event.category);
  return { categories, hosts: add(taste.hosts, hostKey(event)) };
}

// Saturates, so ten pins in a category count more than one but not ten times more
const curve = (count: number, scale: number) => Math.tanh(count / scale);

function tasteBoost(event: EventItem, taste: Taste) {
  return (
    curve(taste.categories[event.category] ?? 0, 3) * MAX_CATEGORY_BOOST + curve(taste.hosts[hostKey(event)] ?? 0, 2) * MAX_HOST_BOOST
  );
}

/* Age */

const OVER_21 = /\b21\s*\+|\b21\s*(and|&|or)\s*(over|up|older)\b|\bmust be 21\b|\b21 years (of age )?(and|or) older\b/;
const OVER_18 = /\b18\s*\+|\b18\s*(and|&|or)\s*(over|up|older)\b|\bmust be 18\b|\badults only\b/;
// "ages 25-35", "ages 25 to 35", "for 25-35 year olds"
const AGE_RANGE = /\bages?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b|\b(\d{2})\s*(?:-|–|to)\s*(\d{2})\s*(?:year[- ]olds|yo)\b/;
// Age groups by decade: "for 20s & 30s", "20s and 30s singles", "in your 30s". Only 20s-60s, and only with
// wording that names an audience, so music nights like "80s & 90s" or "50s and 60s doo-wop" don't count.
const DECADE_PAIR = /\b(?:for|ages?)\s+([2-6]0)'?s\s*(?:and|&|-|–|to)\s*([2-6]0)'?s\b|\b([2-6]0)'?s\s*(?:and|&)\s*([2-6]0)'?s\s+(?:singles|professionals|crowd|only|meetup|mixer|social)\b/;
const DECADE_ONE = /\bin (?:your|their) ([2-6]0)'?s\b/;
const SENIORS = /\bseniors?\b|\bolder adults\b|\b(55|60|62|65)\s*\+|\bretirees?\b/;
const KIDS = /\bkids?\b|\bchildren\b|\btoddlers?\b|\bbabies\b|\bpreschool|\bbest for kids\b|\bstory ?time\b|\bfamily[- ]friendly\b/;

function ageRange(text: string): [number, number] | null {
  const match = text.match(AGE_RANGE);
  if (!match) return null;
  const low = Number(match[1] ?? match[3]);
  const high = Number(match[2] ?? match[4]);
  return low < high ? [low, high] : null;
}

function decadeRange(text: string): [number, number] | null {
  const pair = text.match(DECADE_PAIR);
  if (pair) {
    const low = Number(pair[1] ?? pair[3]);
    const high = Number(pair[2] ?? pair[4]);
    return low < high ? [low, high + 9] : null;
  }
  const one = text.match(DECADE_ONE);
  return one ? [Number(one[1]), Number(one[1]) + 9] : null;
}

// False for events the user can't attend at their age
function ageAllows(text: string, age: number | null) {
  if (age === null) return true;
  if (age < 21 && OVER_21.test(text)) return false;
  if (age < 18 && OVER_18.test(text)) return false;
  const range = ageRange(text);
  // Programs for a set age group, e.g. "ages 13-18" or "ages 5-12"
  if (range && (age < range[0] || age > range[1])) return false;
  return true;
}

function ageBoost(text: string, age: number | null) {
  if (age === null) return 0;
  let boost = 0;
  const decades = decadeRange(text);
  if (decades) boost += age >= decades[0] && age <= decades[1] ? 15 : -20;
  if (SENIORS.test(text)) boost += age >= 55 ? 15 : -15;
  // Adults can still go to family events, so these drop down rather than disappear
  if (KIDS.test(text) && age >= 18) boost -= 15;
  return boost;
}

/* Gender */

// Phrases that name who an event is for. Plain words like "girls" or "mother" are left out, since they turn up in
// titles that aren't aimed at anyone ("Mean Girls", "Mother's Day brunch").
const FOR_WOMEN =
  /\bwomen'?s (?:group|circle|night|run|running|league|networking|only|health|meetup|club)\b|\bwomen in\b|\bfor women\b|\bwomen[- ]only\b|\bwomen (?:founders|entrepreneurs|who)\b|\bwomxn\b|\bladies'? night\b|\bladies (?:only|who)\b|\bfor ladies\b|\bfemale (?:founders|entrepreneurs|only|led)\b|\bgirls who\b|\bmoms'? (?:group|meetup|club|night)\b|\bfor moms\b/;
const FOR_MEN =
  /\bmen'?s (?:group|circle|night|run|running|league|networking|only|health|meetup|club|chorus)\b|\bfor men\b|\bmen[- ]only\b|\bgentlemen'?s club\b|\bguys'? night\b|\bdads'? (?:group|meetup|club|night)\b|\bfor dads\b/;
const FOR_NONBINARY =
  /\bnon-?binary\b|\bgender[- ]?(?:queer|fluid|expansive|diverse)\b|\benby\b|\btrans (?:and|&|\+)\b|\btrans(?:gender| folks| people| community| and non-?binary)\b/;

function genderBoost(text: string, gender: Gender | null) {
  if (gender === null) return 0;
  const women = FOR_WOMEN.test(text);
  const men = FOR_MEN.test(text);
  const nonbinary = FOR_NONBINARY.test(text);
  // Events naming several groups (e.g. "men and women", "women and non-binary folks") are left alone for those groups
  if (gender === 'woman') return (women ? 12 : 0) - (men && !women ? 20 : 0);
  if (gender === 'man') return (men ? 12 : 0) - (women && !men ? 20 : 0);
  return (nonbinary ? 15 : 0) - ((women || men) && !nonbinary ? 10 : 0);
}

// Re-ranks the server's feed for this user: hides events their age rules out, then adds their taste,
// age and gender to the server's score.
export function personalize(events: EventItem[], profile: PersonalProfile, taste: Taste): EventItem[] {
  const count = events.length;
  return events
    .map((event, index) => ({ event, index, text: `${event.title}\n${event.description}`.toLowerCase() }))
    .filter(({ text }) => ageAllows(text, profile.age))
    .map(({ event, index, text }) => {
      // Older responses had no score, so fall back to the server's order
      const base = event.score ?? (1 - index / Math.max(count, 1)) * 100;
      return { event, index, score: base + tasteBoost(event, taste) + ageBoost(text, profile.age) + genderBoost(text, profile.gender) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ event }) => event);
}
