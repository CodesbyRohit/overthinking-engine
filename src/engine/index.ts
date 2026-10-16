export * from './types';
export * from './rng';
export * from './normalize';
export * from './features';
export * from './agents';
export * from './engine';
export * from './simulation';
export * from './tree';
export * from './verdict';
export * from './presets';

import { evaluateDecision } from './engine';
import { normalizeDecision, type DecisionInput } from './normalize';
import type { DecisionResult, ValidationIssue } from './types';

/** Convenience: validate, normalize and evaluate in one call. */
export function analyze(input: DecisionInput): { ok: true; result: DecisionResult } | { ok: false; issues: ValidationIssue[] } {
  const normalized = normalizeDecision(input);
  if (!normalized.ok) return normalized;
  return { ok: true, result: evaluateDecision(normalized.decision) };
}
