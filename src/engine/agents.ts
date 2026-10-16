import { has } from './features';
import { hash01 } from './rng';
import type { AgentContext, AgentDefinition, AgentEvaluation, Alternative, Factor, Features } from './types';

/**
 * The Council of Twelve.
 *
 * Every specialist is a plain deterministic function: score = clamp(base + sum(factor points), 0, 100).
 * Each factor is reported so the UI can show exactly where every point came from.
 * None of these are AI models; they are hand-written satirical scoring rules.
 */

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

function build(base: number, factors: Factor[], explanation: string): AgentEvaluation {
  const raw = base + factors.reduce((s, f) => s + f.points, 0);
  // Zero-point factors are hidden, except when an agent has a single formula factor.
  const shown = factors.length === 1 ? factors : factors.filter((f) => f.points !== 0);
  const all = base !== 0 ? [{ label: 'Baseline', value: `${base}`, points: base }, ...shown] : shown;
  return {
    score: round1(clamp(raw)),
    factors: all.map((f) => ({ ...f, points: round1(f.points) })),
    explanation,
  };
}

function feat(ctx: AgentContext, alt: Alternative): Features {
  return ctx.featuresById[alt.id];
}

const TIER_NAMES = ['free-ish', 'normal', 'pricey', 'premium'] as const;

/** Local icons recognised by the Social Consequences council (Mumbai edition). */
const ICONS: Array<[string, number, string]> = [
  ['vada pav', 10, 'Certified Mumbai icon'],
  ['cutting', 10, 'Cutting chai: the official fuel of Mumbai'],
  ['pav bhaji', 8, 'Juhu beach credibility'],
  ['biryani', 9, 'Biryani: universally defended online'],
  ['samosa', 7, 'Pan-Indian legend status'],
  ['dosa', 7, 'Crispy, photogenic, beyond reproach'],
  ['momo', 5, 'Hostel-approved'],
  ['maggi', 6, 'Nostalgia multiplier'],
];

/** Atomic masses of elements 1..26, so that a=H, b=He, ... z=Fe. Completely irrelevant. */
const ELEMENTS: Array<[string, number]> = [
  ['H', 1.008], ['He', 4.0026], ['Li', 6.94], ['Be', 9.0122], ['B', 10.81], ['C', 12.011], ['N', 14.007],
  ['O', 15.999], ['F', 18.998], ['Ne', 20.18], ['Na', 22.99], ['Mg', 24.305], ['Al', 26.982], ['Si', 28.085],
  ['P', 30.974], ['S', 32.06], ['Cl', 35.45], ['Ar', 39.948], ['K', 39.098], ['Ca', 40.078], ['Sc', 44.956],
  ['Ti', 47.867], ['V', 50.942], ['Cr', 51.996], ['Mn', 54.938], ['Fe', 55.845],
];

export function atomicProfile(key: string): { formula: string; mass: number } {
  const symbols: string[] = [];
  let mass = 0;
  for (const ch of key) {
    const idx = ch.charCodeAt(0) - 97;
    if (idx >= 0 && idx < 26) {
      symbols.push(ELEMENTS[idx][0]);
      mass += ELEMENTS[idx][1];
    }
  }
  return { formula: symbols.join('·') || '∅', mass };
}

/** Value proxy used by the Opportunity Cost bureau. Exported for tests and documentation. */
export function intrinsicValue(f: Features): number {
  const comfort = Math.min(2, ['fried', 'sweet', 'rest', 'caffeine'].filter((t) => f.tags.includes(t as never)).length);
  return (
    50 +
    10 * comfort +
    10 * (has(f, 'healthy') ? 1 : 0) -
    8 * f.costTier +
    4 * Math.min(f.words, 3) +
    6 * (has(f, 'food') ? 1 : 0) -
    10 * (has(f, 'statusQuo') ? 1 : 0)
  );
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'economics',
    name: 'Dr. Paisa Vasool',
    title: 'Chief Economist, Bureau of Snack Economics',
    discipline: 'Economics',
    glyph: '₹',
    weight: 1.2,
    priority: 'Maximum value per rupee, minimum value per letter.',
    rule: '78 − 18 × cost tier − 0.8 per letter beyond 6 + 6 if a multi-word food + 8 if explicitly cheap.',
    objection: '{alt} is fiscally reckless.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      return build(
        78,
        [
          { label: 'Cost tier', value: TIER_NAMES[f.costTier], points: -18 * f.costTier },
          { label: 'Letter tax', value: `${Math.max(0, f.letters - 6)} billable letters`, points: -0.8 * Math.max(0, f.letters - 6) },
          { label: 'Bulk value', value: 'multi-word food', points: has(f, 'food') && f.words >= 2 ? 6 : 0 },
          { label: 'Thrift bonus', value: 'explicitly cheap', points: has(f, 'cheap') ? 8 : 0 },
        ],
        `Classified as ${TIER_NAMES[f.costTier]}. Every letter beyond six is treated as a hidden convenience fee.`,
      );
    },
  },
  {
    id: 'psychology',
    name: 'Prof. Dopa Mean',
    title: 'Head of the Department of Feelings',
    discipline: 'Psychology',
    glyph: '🧠',
    weight: 1.1,
    priority: 'Immediate emotional comfort and vowel-based warmth.',
    rule: '42 + 14 per comfort signal (max 2) + 40 × (vowel ratio − 0.3) − 18 social dread − 6 avoidance guilt.',
    objection: '{alt} gives the Professor anxiety.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const comfort = Math.min(2, ['fried', 'sweet', 'rest', 'caffeine'].filter((t) => f.tags.includes(t as never)).length);
      return build(
        42,
        [
          { label: 'Comfort signals', value: `${comfort}`, points: 14 * comfort },
          { label: 'Vowel warmth', value: `${Math.round(f.vowelRatio * 100)}% vowels`, points: 40 * (f.vowelRatio - 0.3) },
          { label: 'Social dread', value: 'risky social act', points: has(f, 'social') && has(f, 'risky') ? -18 : 0 },
          { label: 'Avoidance guilt', value: 'status quo', points: has(f, 'statusQuo') ? -6 : 0 },
        ],
        comfort > 0
          ? `Detected ${comfort} comfort signal${comfort > 1 ? 's' : ''}. Vowels are known to be emotionally softer than consonants.`
          : 'No comfort signals detected. The Professor relies entirely on vowel warmth.',
      );
    },
  },
  {
    id: 'risk',
    name: 'Cmdr. Worst Case',
    title: 'Directorate of Catastrophe Avoidance',
    discipline: 'Risk',
    glyph: '⚠️',
    weight: 1.3,
    priority: 'Nothing bad must ever happen, including mild indigestion.',
    rule: '82 − 22 risky − 10 fried − 6 social − 3 per word beyond 2 + 8 status quo + 6 healthy.',
    objection: '{alt} has an unacceptable failure surface.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      return build(
        82,
        [
          { label: 'Inherent risk', value: 'risk keywords', points: has(f, 'risky') ? -22 : 0 },
          { label: 'Gastro exposure', value: 'deep-fried', points: has(f, 'fried') ? -10 : 0 },
          { label: 'Human factor', value: 'involves other people', points: has(f, 'social') ? -6 : 0 },
          { label: 'Complexity', value: `${f.words} words`, points: -3 * Math.max(0, f.words - 2) },
          { label: 'Inertia shield', value: 'status quo', points: has(f, 'statusQuo') ? 8 : 0 },
          { label: 'Health buffer', value: 'healthy', points: has(f, 'healthy') ? 6 : 0 },
        ],
        has(f, 'risky')
          ? 'Risk keywords detected. The Commander has already drafted the incident report.'
          : 'No explicit risk keywords. The Commander remains suspicious on principle.',
      );
    },
  },
  {
    id: 'chaos',
    name: 'Dr. Butterfly Effect',
    title: 'Institute for Sensitive Dependence on Initial Conditions',
    discipline: 'Chaos Theory',
    glyph: '🦋',
    weight: 0.7,
    priority: 'Whatever the logistic map says. Nobody can predict it, including the Doctor.',
    rule: 'x₀ = 0.1 + 0.8 × hash(alternative); iterate x ← 3.99·x·(1 − x) once per letter; score = 100 × x.',
    objection: '{alt} sits in an unstable region of phase space.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const x0 = 0.1 + 0.8 * hash01(`chaos:${alt.key}`);
      let x = x0;
      const n = Math.max(1, f.letters);
      for (let i = 0; i < n; i++) x = 3.99 * x * (1 - x);
      return build(
        0,
        [{ label: 'Attractor position', value: `x₀=${x0.toFixed(3)}, ${n} iterations → ${x.toFixed(3)}`, points: 100 * x }],
        'A one-letter change to this alternative would produce an entirely different score. That is the point.',
      );
    },
  },
  {
    id: 'time',
    name: 'Chrono-Analyst Tick-Tock',
    title: 'Ministry of Seconds',
    discipline: 'Time Optimization',
    glyph: '⏱️',
    weight: 1.0,
    priority: 'Minimize total elapsed seconds, starting with pronunciation.',
    rule: '92 − 4 per syllable (≈180 ms each) − 12 effort + 10 instant + 4 rest.',
    objection: '{alt} wastes precious milliseconds.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      return build(
        92,
        [
          { label: 'Pronunciation latency', value: `${f.syllables * 180} ms`, points: -4 * f.syllables },
          { label: 'Physical movement', value: 'requires effort', points: has(f, 'effort') ? -12 : 0 },
          { label: 'Instant gratification', value: 'fast', points: has(f, 'instant') ? 10 : 0 },
          { label: 'Zero setup', value: 'restful', points: has(f, 'rest') ? 4 : 0 },
        ],
        `Saying "${alt.label}" out loud costs ${f.syllables * 180} ms. Over a lifetime of indecision, this adds up.`,
      );
    },
  },
  {
    id: 'regret',
    name: 'Dr. Future You',
    title: 'Office of Hindsight (Time-Travel Division)',
    discipline: 'Regret Minimization',
    glyph: '🔮',
    weight: 1.25,
    priority: 'What will you think about at 3 a.m. in ten years?',
    rule: '58 + 10 action − 10 inaction − 16 risky + 10 healthy + 8 craving satisfied − 4 fried heaviness.',
    objection: 'Future you will replay choosing {alt} at 3 a.m.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const action = !has(f, 'statusQuo');
      return build(
        58,
        [
          { label: 'Action bias', value: action ? 'you did something' : 'you did nothing', points: action ? 10 : -10 },
          { label: '3 a.m. replay risk', value: 'risky', points: has(f, 'risky') ? -16 : 0 },
          { label: 'Future cholesterol', value: 'healthy', points: has(f, 'healthy') ? 10 : 0 },
          { label: 'Craving satisfied', value: 'fried or sweet', points: has(f, 'fried') || has(f, 'sweet') ? 8 : 0 },
          { label: 'Post-snack heaviness', value: 'fried', points: has(f, 'fried') ? -4 : 0 },
        ],
        action
          ? 'Studies that the Doctor half-remembers suggest people regret inaction longer than action.'
          : 'Doing nothing is the fastest route to "what if?" The Doctor disapproves.',
      );
    },
  },
  {
    id: 'social',
    name: 'Baroness Optics',
    title: 'Council of Public Perception',
    discipline: 'Social Consequences',
    glyph: '👑',
    weight: 0.9,
    priority: 'How will this look in the group chat?',
    rule: '55 + 12 photogenic + local icon bonus + 6 social + 5 brand-like two-word name − 20 screenshot hazard − 8 indecisive.',
    objection: '{alt} would be screenshotted and circulated.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const icon = ICONS.find(([term]) => alt.key.includes(term));
      return build(
        55,
        [
          { label: 'Photogenic', value: 'food, clothing or colour', points: has(f, 'food') || has(f, 'clothing') || has(f, 'colorful') ? 12 : 0 },
          { label: 'Icon status', value: icon ? icon[2] : 'none', points: icon ? icon[1] : 0 },
          { label: 'Visible social life', value: 'social', points: has(f, 'social') ? 6 : 0 },
          { label: 'Brandable name', value: 'two words', points: f.words === 2 ? 5 : 0 },
          { label: 'Screenshot hazard', value: 'risky + social', points: has(f, 'social') && has(f, 'risky') ? -20 : 0 },
          { label: 'Looks indecisive', value: 'status quo', points: has(f, 'statusQuo') ? -8 : 0 },
        ],
        icon ? `${icon[2]}. The Baroness approves of the optics.` : 'No iconic status detected. The Baroness is unmoved.',
      );
    },
  },
  {
    id: 'energy',
    name: 'Eng. Joule Saver',
    title: 'Department of Personal Energy Conservation',
    discipline: 'Energy Conservation',
    glyph: '🔋',
    weight: 1.0,
    priority: 'Expend the fewest joules. Typing counts.',
    rule: '70 − 18 effort + 14 rest − 0.5 per letter typed + 8 caloric intake + 6 caffeine injection.',
    objection: '{alt} burns unacceptable joules.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      return build(
        70,
        [
          { label: 'Physical exertion', value: 'effort', points: has(f, 'effort') ? -18 : 0 },
          { label: 'Horizontal bonus', value: 'rest', points: has(f, 'rest') ? 14 : 0 },
          { label: 'Typing cost', value: `${f.letters} keystrokes`, points: -0.5 * f.letters },
          { label: 'Caloric intake', value: 'food', points: has(f, 'food') ? 8 : 0 },
          { label: 'External energy', value: 'caffeine', points: has(f, 'caffeine') ? 6 : 0 },
        ],
        `Typing "${alt.label}" alone costs ${f.letters} keystrokes, approximately ${(f.letters * 0.0012).toFixed(4)} kcal.`,
      );
    },
  },
  {
    id: 'aesthetics',
    name: 'Mme. Kerning',
    title: 'Academy of Visual Harmony',
    discipline: 'Aesthetics',
    glyph: '🎨',
    weight: 0.8,
    priority: 'Typographic beauty, colour, and golden-ratio word lengths.',
    rule: '60 − 6 × |letters per word − 6.47| + 6 per double letter + 10 colour + 6 clothing + 25 palindrome + 20 × (letter diversity − 0.6).',
    objection: 'The kerning of {alt} is an affront.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const lettersOnly = alt.key.replace(/[^\p{L}]/gu, '');
      const palindrome = lettersOnly.length > 2 && lettersOnly === [...lettersOnly].reverse().join('');
      const perWord = f.letters / f.words;
      return build(
        60,
        [
          { label: 'Golden word length', value: `${perWord.toFixed(2)} letters/word vs 4φ ≈ 6.47`, points: -6 * Math.abs(perWord - 6.47) },
          { label: 'Double letters', value: `${f.doubleLetters}`, points: 6 * f.doubleLetters },
          { label: 'Colour', value: 'colourful', points: has(f, 'colorful') ? 10 : 0 },
          { label: 'Fashion', value: 'clothing', points: has(f, 'clothing') ? 6 : 0 },
          { label: 'Palindrome', value: 'symmetric', points: palindrome ? 25 : 0 },
          { label: 'Letter diversity', value: `${Math.round(f.uniqueLetterRatio * 100)}% unique`, points: 20 * (f.uniqueLetterRatio - 0.6) },
        ],
        `Average word length is ${perWord.toFixed(2)} letters; Madame demands 4φ ≈ 6.47.`,
      );
    },
  },
  {
    id: 'opportunity',
    name: 'Dr. Forgone Alternative',
    title: 'Bureau of Paths Not Taken',
    discipline: 'Opportunity Cost',
    glyph: '🚪',
    weight: 1.1,
    priority: 'Every choice is a funeral for every other choice.',
    rule: 'Intrinsic value v = 50 + 10·comfort + 10·healthy − 8·cost + 4·words(≤3) + 6·food − 10·status quo. Score = 50 + 1.5 × (v − best forgone v).',
    objection: 'Choosing {alt} forgoes too much.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      const v = intrinsicValue(f);
      let bestOther = -Infinity;
      let bestLabel = '';
      for (const other of ctx.decision.alternatives) {
        if (other.id === alt.id) continue;
        const ov = intrinsicValue(ctx.featuresById[other.id]);
        if (ov > bestOther) {
          bestOther = ov;
          bestLabel = other.label;
        }
      }
      if (!Number.isFinite(bestOther)) bestOther = v;
      return build(
        50,
        [{ label: 'Net opportunity', value: `v=${v} vs forgone "${bestLabel}" v=${bestOther}`, points: 1.5 * (v - bestOther) }],
        v >= bestOther
          ? `Choosing this forgoes "${bestLabel}" (v=${bestOther}), which is worth no more than this (v=${v}).`
          : `Choosing this forgoes "${bestLabel}", which is worth ${bestOther - v} more value units.`,
      );
    },
  },
  {
    id: 'overanalysis',
    name: 'The Infinite Subcommittee',
    title: 'Standing Committee on Further Review',
    discipline: 'Overanalysis',
    glyph: '📎',
    weight: 0.6,
    priority: 'Prefers whichever option generates the most follow-up meetings.',
    rule: '30 + 6 per word + 2 per syllable + 3 per cross-departmental tag + 15 if the option was invented by the engine.',
    objection: '{alt} is too simple to justify another meeting.',
    evaluate(alt, ctx) {
      const f = feat(ctx, alt);
      return build(
        30,
        [
          { label: 'Words to debate', value: `${f.words}`, points: 6 * f.words },
          { label: 'Syllables to footnote', value: `${f.syllables}`, points: 2 * f.syllables },
          { label: 'Cross-departmental concerns', value: `${f.tags.length} tags`, points: 3 * f.tags.length },
          { label: 'Invented option', value: 'synthetic', points: alt.synthetic ? 15 : 0 },
        ],
        `This option raises ${f.tags.length} cross-departmental concern${f.tags.length === 1 ? '' : 's'}. A working group will be formed.`,
      );
    },
  },
  {
    id: 'irrelevant',
    name: 'Prof. Quasar Tangent',
    title: 'Department of Completely Irrelevant Science',
    discipline: 'Irrelevant Science',
    glyph: '🪐',
    weight: 0.5,
    priority: 'Atomic mass, if each letter were a chemical element. Obviously.',
    rule: 'Map a→H, b→He … z→Fe. Score = total atomic mass modulo 100.',
    objection: '{alt} has a chemically unsatisfying molecular weight.',
    evaluate(alt) {
      const { formula, mass } = atomicProfile(alt.key);
      return build(
        0,
        [{ label: 'Molar mass mod 100', value: `${formula} = ${mass.toFixed(2)} u`, points: mass % 100 }],
        `If "${alt.label}" were a molecule it would weigh ${mass.toFixed(2)} u. This is not relevant. It is, however, science.`,
      );
    },
  },
];

export const TOTAL_WEIGHT = AGENTS.reduce((s, a) => s + a.weight, 0);
