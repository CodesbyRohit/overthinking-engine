import type { Alternative, Features, Tag } from './types';

/**
 * Lexicon used to tag alternatives. Matching is whole-word (with optional plural)
 * against the normalized alternative key. Documented in the README.
 */
export const LEXICON: Record<Tag, string[]> = {
  food: [
    'samosa', 'vada pav', 'pav', 'pav bhaji', 'pizza', 'burger', 'biryani', 'dosa', 'idli', 'maggi', 'noodle',
    'momo', 'momos', 'chai', 'tea', 'coffee', 'salad', 'sandwich', 'pasta', 'rice', 'dal', 'roti', 'paratha',
    'poha', 'upma', 'fries', 'chips', 'cake', 'ice cream', 'chocolate', 'dessert', 'fruit', 'apple', 'banana',
    'mango', 'juice', 'soda', 'cola', 'beer', 'food', 'eat', 'lunch', 'dinner', 'breakfast', 'snack', 'khichdi',
    'thali', 'misal', 'bhel', 'pani puri', 'golgappa', 'sev puri', 'dabeli', 'frankie', 'kebab', 'shawarma',
    'sushi', 'ramen', 'taco', 'soup', 'oats', 'smoothie', 'lassi', 'jalebi', 'ladoo', 'kulfi', 'falooda',
    'pakora', 'kachori', 'donut', 'cookie', 'gulab jamun', 'rasgulla', 'paneer', 'egg', 'omelette', 'toast',
  ],
  fried: [
    'samosa', 'vada', 'vada pav', 'fries', 'chips', 'pakora', 'bhaji', 'jalebi', 'kachori', 'fried', 'burger',
    'puri', 'frankie', 'nugget', 'donut', 'bhature',
  ],
  healthy: [
    'salad', 'fruit', 'apple', 'banana', 'oats', 'smoothie', 'water', 'walk', 'gym', 'run', 'yoga', 'sleep',
    'idli', 'poha', 'sprouts', 'dal', 'soup', 'vegetable', 'khichdi', 'jog', 'exercise', 'meditate', 'stairs',
  ],
  sweet: [
    'cake', 'ice cream', 'chocolate', 'dessert', 'jalebi', 'ladoo', 'kulfi', 'falooda', 'mango', 'donut',
    'sweet', 'sugar', 'gulab jamun', 'rasgulla', 'cookie', 'kheer', 'halwa',
  ],
  caffeine: ['chai', 'tea', 'coffee', 'espresso', 'latte', 'cutting', 'energy drink', 'cola', 'cold coffee'],
  expensive: [
    'premium', 'luxury', 'designer', 'iphone', 'uber', 'ola', 'taxi', 'cab', 'delivery', 'swiggy', 'zomato',
    'buy', 'new', 'upgrade', 'restaurant', 'starbucks', 'sushi', 'five star', 'flight', 'subscription', 'gucci',
    'airpods', 'macbook', 'brand', 'branded', 'book',
  ],
  cheap: [
    'free', 'home', 'homemade', 'tiffin', 'leftover', 'leftovers', 'nothing', 'walk', 'local', 'street',
    'tapri', 'train', 'bus', 'cutting', 'tap water', 'water', 'old', 'existing', 'skip', 'vada pav',
  ],
  effort: [
    'go', 'walk', 'run', 'gym', 'cook', 'clean', 'write', 'study', 'work', 'exercise', 'jog', 'commute',
    'travel', 'call', 'iron', 'wash', 'finish', 'start', 'learn', 'build', 'organize', 'organise', 'read',
    'apply', 'climb', 'stairs', 'close', 'sort', 'fix',
  ],
  rest: [
    'sleep', 'nap', 'stay', 'rest', 'relax', 'chill', 'netflix', 'lie', 'couch', 'bed', 'home', 'skip',
    'wait', 'later', 'tomorrow', 'nothing', 'keep', 'ignore',
  ],
  social: [
    'send', 'text', 'message', 'call', 'reply', 'party', 'meet', 'friend', 'date', 'ex', 'crush', 'group',
    'whatsapp', 'instagram', 'post', 'story', 'dm', 'email', 'invite', 'wedding', 'family', 'boss',
    'colleague', 'hangout', 'mom', 'dad',
  ],
  risky: [
    'ex', 'quit', 'resign', 'confess', 'all', 'delete', 'tattoo', 'crypto', 'bet', 'gamble', 'propose',
    'boss', 'reply all', 'haircut', 'dye', 'risky', 'yolo', 'skydive', 'skydiving', 'midnight', '3am',
  ],
  statusQuo: [
    'nothing', 'keep', 'stay', 'skip', 'wait', 'later', 'ignore', 'not', 'dont', 'no', 'same', 'existing',
    'leave', 'tomorrow', 'postpone', 'current', 'open',
  ],
  tech: [
    'tab', 'tabs', 'browser', 'laptop', 'phone', 'app', 'chrome', 'update', 'restart', 'computer', 'code',
    'bug', 'deploy', 'email', 'wifi', 'iphone', 'android', 'git', 'server', 'pc',
  ],
  colorful: [
    'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple', 'orange', 'gold', 'silver', 'neon',
    'rainbow', 'maroon', 'beige', 'colour', 'color', 'colorful', 'colourful',
  ],
  clothing: [
    'shirt', 't-shirt', 'tshirt', 'kurta', 'jeans', 'saree', 'sari', 'dress', 'hoodie', 'jacket', 'shoes',
    'sneakers', 'outfit', 'suit', 'blazer', 'tie', 'socks', 'shorts', 'top', 'skirt', 'chappal', 'sandals',
    'cap', 'hat', 'sweater',
  ],
  instant: [
    'instant', 'now', 'quick', 'fast', 'maggi', 'vada pav', 'cutting', 'ready', 'takeaway', 'delete',
    'send', 'yes', 'no', 'nothing',
  ],
};

const PREMIUM = ['premium', 'luxury', 'designer', 'iphone', 'macbook', 'gucci', 'five star', 'flight', 'airpods'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const termRegexCache = new Map<string, RegExp>();
function termRegex(term: string): RegExp {
  let re = termRegexCache.get(term);
  if (!re) {
    re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?:s|es)?(?=$|[^\\p{L}\\p{N}])`, 'u');
    termRegexCache.set(term, re);
  }
  return re;
}

export function hasTerm(key: string, term: string): boolean {
  return termRegex(term).test(key);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return word.trim().length > 0 ? 1 : 0;
  const groups = w.match(/[aeiouy]+/g)?.length ?? 0;
  const silentE = w.length > 2 && w.endsWith('e') && !w.endsWith('le') && groups > 1 ? 1 : 0;
  return Math.max(1, groups - silentE);
}

/** Deterministically extract the scoring features of an alternative. */
export function extractFeatures(alt: Alternative): Features {
  const key = alt.key;
  const letterChars = key.replace(/[^\p{L}]/gu, '');
  const letters = letterChars.length;
  const words = key.split(' ').filter(Boolean);
  const vowels = (letterChars.match(/[aeiou]/g) ?? []).length;
  const unique = new Set(letterChars).size;
  const doubleLetters = (key.match(/(\p{L})\1/gu) ?? []).length;

  const tags = (Object.keys(LEXICON) as Tag[]).filter((tag) => LEXICON[tag].some((term) => hasTerm(key, term)));

  let costTier: Features['costTier'] = 1;
  if (PREMIUM.some((t) => hasTerm(key, t))) costTier = 3;
  else if (tags.includes('expensive')) costTier = 2;
  else if (tags.includes('cheap')) costTier = 0;

  return {
    letters,
    words: Math.max(1, words.length),
    syllables: Math.max(1, words.reduce((sum, w) => sum + countSyllables(w), 0)),
    vowelRatio: letters === 0 ? 0 : vowels / letters,
    uniqueLetterRatio: letters === 0 ? 0 : unique / letters,
    doubleLetters,
    tags,
    costTier,
  };
}

export function has(f: Features, tag: Tag): boolean {
  return f.tags.includes(tag);
}
