/** Shared types for the Overthinking Engine decision core. */

export type Tag =
  | 'food'
  | 'fried'
  | 'healthy'
  | 'sweet'
  | 'caffeine'
  | 'expensive'
  | 'cheap'
  | 'effort'
  | 'rest'
  | 'social'
  | 'risky'
  | 'statusQuo'
  | 'tech'
  | 'colorful'
  | 'clothing'
  | 'instant';

export interface Alternative {
  /** Stable identifier derived from the normalized label. */
  id: string;
  /** Display label, e.g. "Vada pav". */
  label: string;
  /** Lower-cased, whitespace-collapsed label used for scoring and hashing. */
  key: string;
  /** True when the engine invented this alternative (e.g. "Do absolutely nothing"). */
  synthetic: boolean;
}

export interface Features {
  letters: number;
  words: number;
  syllables: number;
  vowelRatio: number;
  uniqueLetterRatio: number;
  doubleLetters: number;
  tags: Tag[];
  /** 0 = free, 1 = normal, 2 = pricey, 3 = premium. */
  costTier: 0 | 1 | 2 | 3;
}

export interface NormalizedDecision {
  /** Original dilemma, trimmed and whitespace-collapsed. */
  dilemma: string;
  /** Verb removed from the first alternative (e.g. "order"), if any. */
  sharedVerb: string | null;
  alternatives: Alternative[];
  /** Human-readable notes about what the normalizer did. */
  notes: string[];
  /** Canonical string used to seed every deterministic process. */
  canonicalKey: string;
}

export interface ValidationIssue {
  field: 'dilemma' | 'alternatives';
  message: string;
}

export interface Factor {
  label: string;
  value: string;
  /** Signed contribution in points to the agent's raw score. */
  points: number;
}

export interface AgentEvaluation {
  /** Score in [0, 100]. */
  score: number;
  factors: Factor[];
  explanation: string;
}

export interface AgentContext {
  decision: NormalizedDecision;
  featuresById: Record<string, Features>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  discipline: string;
  glyph: string;
  /** Documented weight used by the aggregator. */
  weight: number;
  priority: string;
  /** Plain-language scoring rule shown in the UI. */
  rule: string;
  /** Pithy objection template; {alt} is replaced with the objected alternative. */
  objection: string;
  evaluate(alternative: Alternative, ctx: AgentContext): AgentEvaluation;
}

export interface AgentAltScore extends AgentEvaluation {
  alternativeId: string;
  /** weight * score / totalWeight: this agent's points inside the aggregate. */
  contribution: number;
}

export interface AgentReport {
  agentId: string;
  name: string;
  title: string;
  discipline: string;
  glyph: string;
  weight: number;
  /** Share of total weight, 0..1. */
  weightShare: number;
  priority: string;
  rule: string;
  scores: AgentAltScore[];
  /** The alternative this agent scored highest. */
  voteId: string;
  /** Lowest-scored alternative, with an objection. */
  objection: { alternativeId: string; text: string };
  /** One-line summary of the agent's position. */
  summary: string;
  /** True when this agent voted for the final winner. */
  agreesWithVerdict: boolean;
}

export interface Standing {
  alternativeId: string;
  label: string;
  aggregate: number;
  votes: number;
  rank: number;
}

export type TieBreak = 'none' | 'votes' | 'risk' | 'sacred-hash';

export interface Counterfactual {
  id: string;
  question: string;
  answer: string;
  /** True when the hypothetical changes the winner. */
  flipsVerdict: boolean;
  newWinnerId: string | null;
}

export interface FlipAnalysis {
  alternativeId: string;
  /** Agent whose weight boost helps this alternative most. */
  agentId: string | null;
  /** Weight multiplier needed on that agent for this alternative to win (null = impossible). */
  multiplier: number | null;
  /** Points this alternative trails the winner by. */
  deficit: number;
}

export interface DecisionResult {
  decision: NormalizedDecision;
  features: Record<string, Features>;
  agents: AgentReport[];
  standings: Standing[];
  winnerId: string;
  /** Margin between first and second aggregate scores. */
  margin: number;
  tie: { occurred: boolean; tiedIds: string[]; resolvedBy: TieBreak };
  /** Fraction of agents voting for the winner (0..1). */
  agreement: number;
  /** Agents whose removal would change the winner. */
  pivotalAgentIds: string[];
  /** Winner when each agent is removed in turn. */
  leaveOneOut: { agentId: string; winnerId: string }[];
  counterfactuals: Counterfactual[];
  flips: FlipAnalysis[];
  explanation: string[];
  totalWeight: number;
}
