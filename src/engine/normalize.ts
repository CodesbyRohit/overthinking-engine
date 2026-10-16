import { hashString } from './rng';
import type { Alternative, NormalizedDecision, ValidationIssue } from './types';

export const LIMITS = {
  dilemmaMin: 3,
  dilemmaMax: 280,
  alternativeMax: 60,
  maxAlternatives: 6,
} as const;

export const NOTHING_LABEL = 'Do absolutely nothing';

export interface DecisionInput {
  dilemma: string;
  /** Optional user-supplied alternatives. Blank entries are ignored. */
  alternatives?: string[];
}

export type NormalizeResult =
  | { ok: true; decision: NormalizedDecision }
  | { ok: false; issues: ValidationIssue[] };

/** Verbs that are usually shared across all alternatives ("order X or Y"). */
const SHARED_VERBS = new Set([
  'order', 'eat', 'have', 'get', 'buy', 'wear', 'watch', 'drink', 'take', 'grab',
  'choose', 'pick', 'play', 'read', 'book', 'try', 'cook', 'make', 'call', 'text',
  'send', 'close', 'keep', 'go', 'do', 'skip', 'open', 'use', 'listen', 'visit',
  'learn', 'start', 'stay', 'ignore', 'reply', 'post', 'delete', 'leave', 'wait',
]);

const LEAD_IN =
  /^(?:(?:so|ok|okay|hmm+|help|guys|yaar|bro)[,!.]*\s+)*(?:should\s+i|shall\s+i|do\s+i|can\s+i|could\s+i|would\s+i|must\s+i|will\s+i|is\s+it\s+better\s+to|whether\s+(?:i\s+should|to)|i\s+(?:can'?t|cannot)\s+decide\s+(?:between|whether\s+to|if\s+i\s+should)|(?:help\s+me\s+)?(?:choose|decide|pick)\s+(?:between)?|which\s+(?:one|is\s+better)[:,]?|what\s+should\s+i\s+(?:do|choose|pick)[:,]?)(?:\s+|$)/i;

const BETWEEN = /\bbetween\b/i;
const OPEN_QUESTION = /^(?:what|which|where|when|who|how|why)\b/i;
const QUOTES = /[“”"'‘’`]/g;
const EDGE_QUOTES = /^[“”"'‘’`]+|[“”"'‘’`]+$/g;
const ELLIPSIS = '…';

/** Collapse whitespace and trim. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Canonical comparison key for an alternative. */
export function toKey(label: string): string {
  return cleanText(label.toLowerCase().replace(QUOTES, '').replace(/[^\p{L}\p{N}\s&+-]/gu, ' '));
}

function toDisplay(label: string): string {
  const cleaned = cleanText(label.replace(EDGE_QUOTES, '')).replace(/[?!.,;:]+$/, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function makeAlternative(label: string, synthetic: boolean): Alternative {
  const display = toDisplay(label);
  const key = toKey(display);
  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'option';
  return {
    id: `alt-${slug}-${hashString(key).toString(36).slice(0, 4)}`,
    label: display,
    key,
    synthetic,
  };
}

/**
 * Extract alternatives from free text such as "Should I order samosa or vada pav?".
 * Returns the raw segments plus a shared verb if one was stripped.
 */
export function extractAlternatives(dilemma: string): { segments: string[]; sharedVerb: string | null; openQuestion: boolean } {
  let text = cleanText(dilemma).replace(/[?!.]+$/, '');
  const hadBetween = BETWEEN.test(text);
  text = text.replace(LEAD_IN, '');
  text = text.replace(/^between\s+/i, '');

  // "What should I eat?" names no alternatives at all.
  if (OPEN_QUESTION.test(text) && !/\s(?:or|vs\.?|versus)\s|,|\//i.test(text)) {
    return { segments: [], sharedVerb: null, openQuestion: true };
  }

  const splitter = hadBetween
    ? /\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+|\s+vs\.?\s+|\s+versus\s+|\s*\/\s*/i
    : /\s*,\s*(?:or\s+)?|\s+or\s+|\s+vs\.?\s+|\s+versus\s+|\s*\/\s*/i;

  const segments = text
    .split(splitter)
    .map((s) => cleanText(s.replace(/^(?:either|or)\s+/i, '')))
    .filter((s) => s.length > 0 && toKey(s).length > 0);

  let sharedVerb: string | null = null;
  if (segments.length >= 2) {
    const [first, ...rest] = segments;
    const firstWords = first.split(' ');
    const verb = firstWords[0].toLowerCase();
    const othersStartWithVerb = rest.some((s) => SHARED_VERBS.has(s.split(' ')[0].toLowerCase()));
    if (firstWords.length >= 2 && SHARED_VERBS.has(verb) && !othersStartWithVerb) {
      sharedVerb = verb;
      segments[0] = firstWords.slice(1).join(' ');
    }
  }
  return { segments, sharedVerb, openQuestion: false };
}

/** Validate raw user input. Returns an empty array when everything is acceptable. */
export function validateInput(input: DecisionInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dilemma = cleanText(input.dilemma ?? '');
  if (dilemma.length === 0) {
    issues.push({ field: 'dilemma', message: 'The Council cannot overthink a void. Please type a dilemma.' });
  } else if (dilemma.length < LIMITS.dilemmaMin) {
    issues.push({ field: 'dilemma', message: `Too short. Even overthinking needs at least ${LIMITS.dilemmaMin} characters.` });
  } else if (dilemma.length > LIMITS.dilemmaMax) {
    issues.push({
      field: 'dilemma',
      message: `That dilemma is ${dilemma.length} characters. The limit is ${LIMITS.dilemmaMax}. You are already overthinking it.`,
    });
  }

  const custom = (input.alternatives ?? []).map(cleanText).filter((a) => a.length > 0);
  if (custom.length > LIMITS.maxAlternatives) {
    issues.push({
      field: 'alternatives',
      message: `Maximum ${LIMITS.maxAlternatives} alternatives. The Council's attention span is finite.`,
    });
  }
  const tooLong = custom.find((a) => a.length > LIMITS.alternativeMax);
  if (tooLong) {
    issues.push({
      field: 'alternatives',
      message: `Alternative "${tooLong.slice(0, 24)}${ELLIPSIS}" exceeds ${LIMITS.alternativeMax} characters.`,
    });
  }
  const unscorable = custom.find((a) => toKey(a).length === 0);
  if (unscorable) {
    issues.push({ field: 'alternatives', message: `Alternative "${unscorable}" contains no letters or numbers to analyze.` });
  }
  return issues;
}

/**
 * Validate and normalize a dilemma into a deterministic decision description.
 * Alternatives are taken from the custom list when provided, otherwise extracted
 * from the dilemma text. Missing alternatives are filled with synthetic ones.
 */
export function normalizeDecision(input: DecisionInput): NormalizeResult {
  const issues = validateInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const dilemma = cleanText(input.dilemma);
  const notes: string[] = [];
  const custom = (input.alternatives ?? []).map(cleanText).filter((a) => a.length > 0);

  let rawSegments: string[];
  let sharedVerb: string | null = null;
  let openQuestion = false;
  if (custom.length > 0) {
    rawSegments = custom;
    notes.push(`Using ${custom.length} custom alternative${custom.length === 1 ? '' : 's'} supplied by the petitioner.`);
  } else {
    const extracted = extractAlternatives(dilemma);
    rawSegments = extracted.segments;
    sharedVerb = extracted.sharedVerb;
    openQuestion = extracted.openQuestion;
    if (sharedVerb) notes.push(`Detected shared verb "${sharedVerb}" and factored it out of every alternative.`);
    if (rawSegments.length > LIMITS.maxAlternatives) {
      notes.push(`Found ${rawSegments.length} alternatives; only the first ${LIMITS.maxAlternatives} were admitted to the hearing.`);
      rawSegments = rawSegments.slice(0, LIMITS.maxAlternatives);
    }
  }

  const alternatives: Alternative[] = [];
  const seen = new Set<string>();
  for (const segment of rawSegments) {
    if (segment.length > LIMITS.alternativeMax) {
      notes.push(`Alternative "${segment.slice(0, 24)}${ELLIPSIS}" was truncated to ${LIMITS.alternativeMax} characters.`);
    }
    const alt = makeAlternative(segment.slice(0, LIMITS.alternativeMax), false);
    if (seen.has(alt.key)) {
      notes.push(`Duplicate alternative "${alt.label}" was merged. The committee only bills once.`);
      continue;
    }
    seen.add(alt.key);
    alternatives.push(alt);
  }

  if (alternatives.length === 0 && openQuestion) {
    alternatives.push(makeAlternative('Go with your gut', true), makeAlternative('Ask the group chat', true));
    notes.push('Open-ended question with no alternatives. Add custom alternatives for a real hearing; the Council has assumed the two universal options.');
  } else if (alternatives.length === 0) {
    alternatives.push(makeAlternative('Yes, do it', true), makeAlternative('No, do not', true));
    notes.push('No alternatives detected. The Council has assumed this is a yes/no question.');
  } else if (alternatives.length === 1) {
    const nothing = makeAlternative(NOTHING_LABEL, true);
    if (nothing.key === alternatives[0].key) {
      alternatives.push(makeAlternative('Do literally anything else', true));
    } else {
      alternatives.push(nothing);
    }
    notes.push(`Only one alternative found. Added "${alternatives[1].label}" as the counterfactual.`);
  }

  const canonicalKey = `${toKey(dilemma)}::${alternatives
    .map((a) => a.key)
    .sort()
    .join('|')}`;

  return { ok: true, decision: { dilemma, sharedVerb, alternatives, notes, canonicalKey } };
}
