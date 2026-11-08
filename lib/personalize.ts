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

// The app is for ages 7 and up
export const MIN_AGE = 7;
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
// A minimum age that isn't 18 or 21: "ages 30+", "30+ only", "single mixer 30+"
const AGE_FLOOR = /\bages?\s*(\d{2})\s*\+|\b(\d{2})\s*\+\s*(?:only|singles|crowd|mixer)\b|\b(?:mixer|social|meetup|crowd)\s*(\d{2})\s*\+/;
// "ages 25-35", "ages 25 to 35", "for 25-35 year olds"
const AGE_RANGE = /\bages?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b|\b(\d{2})\s*(?:-|–|to)\s*(\d{2})\s*(?:year[- ]olds|yo)\b/;
// Age groups by decade: "for 20s & 30s", "20s and 30s singles", "in your 30s". Only 20s-60s, and only with
// wording that names an audience, so music nights like "80s & 90s" or "50s and 60s doo-wop" don't count.
const DECADE_PAIR = /\b(?:for|ages?)\s+([2-6]0)'?s\s*(?:and|&|-|–|to)\s*([2-6]0)'?s\b|\b([2-6]0)'?s\s*(?:and|&)\s*([2-6]0)'?s\s+(?:singles|professionals|crowd|only|meetup|mixer|social)\b/;
const DECADE_ONE = /\bin (?:your|their) ([2-6]0)'?s\b/;
const SENIORS = /\bseniors?\b|\bolder adults\b|\b(55|60|62|65)\s*\+|\bretirees?\b/;
// Events that need an adult even when the listing doesn't say "21+" or "18+": dating, nightlife, drinking
const ADULT_ONLY = /\bspeed dating\b|\bsingles\b|\bsingle (?:mixer|night|party|event|meetup)s?\b|\bdating\b|\bstrip club\b|\bburlesque\b|\bboudoir\b/;
const NIGHTLIFE = /\bnightclub\b|\bclub night\b|\brave\b|\bafterparty\b|\b(?:dance|house|yacht|boat|club|rooftop|warehouse|after|techno|dj)[- ]party\b|\bparty cruise\b/;
const DRINKING =
  /\bdrinks\b|\bsip\b|\bhappy hour\b|\bbar crawl\b|\bpub crawl\b|\bwine tasting\b|\bbeer tasting\b|\bwhiskey\b|\bwhisky\b|\bcocktails?\b|\bbrewery\b|\bbrewing co\b|\bopen bar\b|\bbottomless\b|\bsake tasting\b|\bmixology\b/;
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
function ageAllows(event: EventItem, text: string, age: number | null) {
  if (age === null) return true;
  if (age < 21 && (OVER_21.test(text) || DRINKING.test(text))) return false;
  if (age < 18 && (OVER_18.test(text) || ADULT_ONLY.test(text) || NIGHTLIFE.test(text) || event.category === 'Nightlife')) return false;
  const floor = text.match(AGE_FLOOR);
  if (floor && age < Number(floor[1] ?? floor[2] ?? floor[3])) return false;
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
  // Kids' programs rise for children; adults can still go to family events, so for them these drop rather than disappear
  if (KIDS.test(text)) boost += age < 13 ? 15 : age >= 18 ? -15 : 0;
  return boost;
}

/* Gender */

// Activities and gatherings that an event "for men" or "for women" restricts: "Men's Pickleball",
// "Women's Beginner Climbing", "Mens Open Play"... A word or two may sit in between ("Women's Open Pickleball").
const ACTIVITIES =
  'pickleball|tennis|padel|squash|badminton|table tennis|ping pong|soccer|futsal|basketball|volleyball|softball|baseball|hockey|rugby|football|flag football|lacrosse|ultimate|frisbee|golf|cricket|climbing|bouldering|run|runs|running|jog|cycling|ride|rowing|swim|swimming|boxing|kickboxing|muay thai|jiu[- ]?jitsu|bjj|wrestling|martial arts|self[- ]defense|yoga|pilates|fitness|workout|bootcamp|strength|lifting|hike|hiking|chess|poker|league|leagues|team|clinic|open play|drop[- ]?in|pickup|pick[- ]up|scrimmage|ladder|round robin|doubles|tournament|group|groups|circle|night|club|meetup|meet[- ]up|chorus|choir|retreat|brunch|dinner|mixer|networking|social|support|only';
// The words in between can't be "in", "who", "and" or "&", so "Women in Tech Mixer" or "Men and Women Social" don't count
const gendered = (who: string) =>
  new RegExp(`\\b(?:${who})\\s+(?:(?!(?:in|who|and|&)\\s)[\\w-]+\\s+){0,2}?(?:${ACTIVITIES})\\b`);

// Phrases that say who an event is for. Plain words like "girls" or "mother" are left out, since they turn up in
// titles that aren't aimed at anyone ("Mean Girls", "Mother's Day brunch").
const FOR_WOMEN = new RegExp(
  [
    gendered("women's|womens|women|ladies'?|ladies|female|girls'"),
    /\bfor (?:women|ladies|moms|girls)\b|\bwomen[- ]only\b|\bfemale[- ]only\b|\bwomxn\b|\bladies'? night\b|\bmoms'? (?:group|meetup|club|night)\b/,
  ]
    .map((pattern) => pattern.source)
    .join('|'),
);
const FOR_MEN = new RegExp(
  [
    gendered("men's|mens|men|male|guys'|boys'"),
    /\bfor (?:men|guys|dads)\b|\bmen[- ]only\b|\bgentlemen'?s club\b|\bguys'? night\b|\bdads'? (?:group|meetup|club|night)\b/,
  ]
    .map((pattern) => pattern.source)
    .join('|'),
);
// Celebrates or supports women but is usually open to everyone: ranks up for women, never hidden from others
const ABOUT_WOMEN =
  /\bwomen in\b|\bwomen (?:founders|entrepreneurs|who)\b|\bfor women (?:founders|entrepreneurs|leaders|in (?:tech|business|finance|stem|ai|leadership|law|media|film|music|healthcare|science|engineering|product|design|real estate|vc|venture))\b|\bfemale (?:founders|entrepreneurs|led)\b|\bgirls who\b/;
// Topics rather than audiences ("Women's History Month", "men's fashion sale"), ignored when deciding who an event is for
// Also promotions ("free drink for ladies") and the inclusive phrases above, which don't restrict who can come
const TOPICS =
  /\b(?:women|men)'?s (?:history|rights|suffrage|day|march|studies|fashion|clothing|apparel|shoes|sneakers|wear|grooming|sample sale)\b|\binternational women'?s day\b|\b(?:free |comp |complimentary )?drinks? (?:for|special for) (?:ladies|women)\b|\bladies (?:drink|get in) free\b|\bfor women (?:founders|entrepreneurs|leaders|in (?:tech|business|finance|stem|ai|leadership|law|media|film|music|healthcare|science|engineering|product|design|real estate|vc|venture))\b/g;
const FOR_NONBINARY =
  /\bnon-?binary\b|\bgender[- ]?(?:queer|fluid|expansive|diverse)\b|\benby\b|\btrans (?:and|&|\+)\b|\btrans(?:gender| folks| people| community| and non-?binary)\b/;
// Open to everyone, even when a men's or women's division is mentioned
const OPEN_TO_ALL = /\bco-?ed\b|\bmoms,? (?:and |& )?dads\b|\bdads,? (?:and |& )?moms\b|\bparents and caregivers\b|\bmixed\b|\ball genders\b|\bmen and women\b|\bwomen and men\b|\bmen'?s and women'?s\b|\bwomen'?s and men'?s\b/;

type GenderTargets = { women: boolean; men: boolean; aboutWomen: boolean; nonbinary: boolean; open: boolean };

function genderTargets(text: string): GenderTargets {
  const audience = text.replace(TOPICS, ' ');
  return {
    women: FOR_WOMEN.test(audience),
    men: FOR_MEN.test(audience),
    aboutWomen: ABOUT_WOMEN.test(text),
    nonbinary: FOR_NONBINARY.test(audience),
    open: OPEN_TO_ALL.test(audience),
  };
}

// False for events aimed only at a different gender: a men's league for a woman, a women's group for a man
function genderAllows(targets: GenderTargets, gender: Gender | null) {
  if (gender === null || targets.open || targets.nonbinary) return true;
  if (gender === 'woman') return !(targets.men && !targets.women);
  if (gender === 'man') return !(targets.women && !targets.men);
  // Many women's groups welcome non-binary people, so for them these drop down rather than disappear
  return true;
}

function genderBoost(targets: GenderTargets, gender: Gender | null) {
  if (gender === null) return 0;
  if (gender === 'woman') return targets.women || targets.aboutWomen ? 12 : 0;
  if (gender === 'man') return targets.men ? 12 : 0;
  return (targets.nonbinary ? 15 : 0) - ((targets.women || targets.men) && !targets.nonbinary && !targets.open ? 10 : 0);
}

// Re-ranks the server's feed for this user: hides events their age or gender rules out, then adds their taste,
// age and gender to the server's score.
export function personalize(events: EventItem[], profile: PersonalProfile, taste: Taste): EventItem[] {
  const count = events.length;
  return events
    // Curly apostrophes (Men’s, Women’s) are common in titles, so they're straightened before matching
    .map((event, index) => {
      const text = `${event.title}\n${event.description}`.toLowerCase().replace(/[\u2018\u2019\u02bc`]/g, "'");
      return { event, index, text, targets: genderTargets(text) };
    })
    .filter(({ event, text, targets }) => ageAllows(event, text, profile.age) && genderAllows(targets, profile.gender))
    .map(({ event, index, text, targets }) => {
      // Older responses had no score, so fall back to the server's order
      const base = event.score ?? (1 - index / Math.max(count, 1)) * 100;
      return { event, index, score: base + tasteBoost(event, taste) + ageBoost(text, profile.age) + genderBoost(targets, profile.gender) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ event }) => event);
}
