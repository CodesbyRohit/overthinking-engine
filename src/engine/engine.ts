import { AGENTS, TOTAL_WEIGHT } from './agents';
import { extractFeatures } from './features';
import { hashString } from './rng';
import type {
  AgentContext,
  AgentReport,
  Counterfactual,
  DecisionResult,
  Features,
  FlipAnalysis,
  NormalizedDecision,
  Standing,
  TieBreak,
} from './types';

/** Aggregates within this distance (after rounding to 2 decimals) are considered tied. */
export const TIE_EPSILON = 0.005;

export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Weighted mean of each alternative's scores. scores is indexed [agent][alternative]. */
export function aggregateScores(scores: number[][], weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const altCount = scores[0]?.length ?? 0;
  const out = new Array<number>(altCount).fill(0);
  if (total <= 0) return out;
  for (let i = 0; i < scores.length; i++) {
    const w = weights[i];
    if (w === 0) continue;
    for (let a = 0; a < altCount; a++) out[a] += w * scores[i][a];
  }
  return out.map((v) => v / total);
}

interface RankInputs {
  aggregates: number[];
  votes: number[];
  riskScores: number[];
  /** Deterministic per-alternative hash ("The Sacred Hash"), lowest wins. */
  hashes: number[];
}

/**
 * Order alternatives best-first. Rules, in order:
 *  1. Higher aggregate score (rounded to 2 decimals).
 *  2. More specialist votes.
 *  3. Higher score from the Risk directorate (safety first).
 *  4. Lower Sacred Hash (FNV-1a of the decision + alternative key). Always decisive.
 */
export function rankAlternatives({ aggregates, votes, riskScores, hashes }: RankInputs): {
  order: number[];
  tie: { occurred: boolean; tied: number[]; resolvedBy: TieBreak };
} {
  const idx = aggregates.map((_, i) => i);
  const agg = aggregates.map(round2);
  idx.sort((x, y) => agg[y] - agg[x] || votes[y] - votes[x] || riskScores[y] - riskScores[x] || hashes[x] - hashes[y]);

  const top = idx[0];
  const tied = idx.filter((i) => Math.abs(agg[i] - agg[top]) < TIE_EPSILON);
  let resolvedBy: TieBreak = 'none';
  if (tied.length > 1) {
    const second = idx[1];
    if (votes[top] !== votes[second]) resolvedBy = 'votes';
    else if (riskScores[top] !== riskScores[second]) resolvedBy = 'risk';
    else resolvedBy = 'sacred-hash';
  }
  return { order: idx, tie: { occurred: tied.length > 1, tied, resolvedBy } };
}

/** Index of the highest score, ties broken by a deterministic per-agent hash. */
function argBest(values: number[], tieKeys: number[], best: 'max' | 'min'): number {
  let bi = 0;
  for (let i = 1; i < values.length; i++) {
    const better = best === 'max' ? values[i] > values[bi] : values[i] < values[bi];
    if (better || (values[i] === values[bi] && tieKeys[i] < tieKeys[bi])) bi = i;
  }
  return bi;
}

/**
 * Exact weight multiplier k on agent j so that alternative a beats every other
 * alternative. Aggregates are linear-fractional in k with a shared denominator,
 * so a beats b iff D_ab + (k − 1)·d_ab > 0, where D_ab is the current weighted
 * difference and d_ab = w_j(s_aj − s_bj). Returns null when impossible.
 */
export function flipMultiplier(scores: number[][], weights: number[], a: number, j: number): number | null {
  let needed = 1;
  for (let b = 0; b < scores[0].length; b++) {
    if (b === a) continue;
    let D = 0;
    for (let i = 0; i < scores.length; i++) D += weights[i] * (scores[i][a] - scores[i][b]);
    const d = weights[j] * (scores[j][a] - scores[j][b]);
    if (D > 0) continue; // already ahead of b
    if (d <= 0) return null; // agent j cannot help against b
    needed = Math.max(needed, 1 - D / d);
  }
  return needed;
}

/** Run the full deterministic Council evaluation for a normalized decision. */
export function evaluateDecision(decision: NormalizedDecision): DecisionResult {
  const alts = decision.alternatives;
  const features: Record<string, Features> = {};
  for (const alt of alts) features[alt.id] = extractFeatures(alt);
  const ctx: AgentContext = { decision, featuresById: features };

  const weights = AGENTS.map((a) => a.weight);
  const evaluations = AGENTS.map((agent) => alts.map((alt) => agent.evaluate(alt, ctx)));
  const scores = evaluations.map((row) => row.map((e) => e.score));

  const altHashes = alts.map((alt) => hashString(`${decision.canonicalKey}#${alt.key}`));
  const voteIdx = AGENTS.map((agent, i) =>
    argBest(scores[i], alts.map((alt) => hashString(`${agent.id}:${alt.key}`)), 'max'),
  );
  const objectionIdx = AGENTS.map((agent, i) =>
    argBest(scores[i], alts.map((alt) => hashString(`${agent.id}:objects:${alt.key}`)), 'min'),
  );
  const votes = alts.map((_, a) => voteIdx.filter((v) => v === a).length);
  const riskRow = AGENTS.findIndex((a) => a.id === 'risk');
  const riskScores = scores[riskRow];

  const rankWith = (w: number[], v = votes) => rankAlternatives({ aggregates: aggregateScores(scores, w), votes: v, riskScores, hashes: altHashes });

  const aggregates = aggregateScores(scores, weights);
  const { order, tie } = rankWith(weights);
  const winner = order[0];
  const runnerUp = order[1];

  const standings: Standing[] = order.map((a, rank) => ({
    alternativeId: alts[a].id,
    label: alts[a].label,
    aggregate: round2(aggregates[a]),
    votes: votes[a],
    rank: rank + 1,
  }));

  const agents: AgentReport[] = AGENTS.map((agent, i) => {
    const vote = alts[voteIdx[i]];
    const objected = alts[objectionIdx[i]];
    return {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      discipline: agent.discipline,
      glyph: agent.glyph,
      weight: agent.weight,
      weightShare: agent.weight / TOTAL_WEIGHT,
      priority: agent.priority,
      rule: agent.rule,
      scores: alts.map((alt, a) => ({
        ...evaluations[i][a],
        alternativeId: alt.id,
        contribution: round2((agent.weight * scores[i][a]) / TOTAL_WEIGHT),
      })),
      voteId: vote.id,
      objection: { alternativeId: objected.id, text: agent.objection.replace('{alt}', objected.label) },
      summary: `Votes ${vote.label} (${scores[i][voteIdx[i]]}); objects to ${objected.label} (${scores[i][objectionIdx[i]]}).`,
      agreesWithVerdict: voteIdx[i] === winner,
    };
  });

  // Leave-one-out: does any single specialist decide the outcome?
  const leaveOneOut = AGENTS.map((agent, i) => {
    const w = weights.map((x, k) => (k === i ? 0 : x));
    const v = votes.map((count, a) => count - (voteIdx[i] === a ? 1 : 0));
    return { agentId: agent.id, winnerId: alts[rankWith(w, v).order[0]].id };
  });
  const pivotalAgentIds = leaveOneOut.filter((l) => l.winnerId !== alts[winner].id).map((l) => l.agentId);

  // Flip analysis for every rejected alternative.
  const flips: FlipAnalysis[] = order.slice(1).map((a) => {
    let best: { j: number; k: number } | null = null;
    for (let j = 0; j < AGENTS.length; j++) {
      const k = flipMultiplier(scores, weights, a, j);
      if (k !== null && (best === null || k < best.k)) best = { j, k };
    }
    return {
      alternativeId: alts[a].id,
      agentId: best ? AGENTS[best.j].id : null,
      multiplier: best ? Math.ceil(best.k * 100 + 1e-9) / 100 : null,
      deficit: round2(round2(aggregates[winner]) - round2(aggregates[a])),
    };
  });

  const counterfactuals = buildCounterfactuals();

  function buildCounterfactuals(): Counterfactual[] {
    const out: Counterfactual[] = [];
    const winnerLabel = alts[winner].label;
    const describe = (newWinner: number, id: string, question: string, extra: string) => {
      const flipped = newWinner !== winner;
      out.push({
        id,
        question,
        answer: flipped
          ? `${alts[newWinner].label} would win instead. ${extra}`
          : `${winnerLabel} would still win. ${extra}`,
        flipsVerdict: flipped,
        newWinnerId: flipped ? alts[newWinner].id : null,
      });
    };

    const equal = rankWith(weights.map(() => 1)).order[0];
    describe(equal, 'cf-equal-weights', 'What if every specialist had equal weight?', 'Weights are documented, not sacred.');

    const maxVotes = Math.max(...votes);
    const voteLeaders = alts.map((_, a) => a).filter((a) => votes[a] === maxVotes);
    const voteWinner = voteLeaders.length === 1 ? voteLeaders[0] : order.find((a) => voteLeaders.includes(a))!;
    describe(
      voteWinner,
      'cf-majority-vote',
      'What if only votes counted (simple majority)?',
      `It would receive ${maxVotes} of ${AGENTS.length} votes${voteLeaders.length > 1 ? ' (tied vote, broken by aggregate)' : ''}.`,
    );

    const riskHeavy = weights.map((w, i) => (i === riskRow ? w * 2 : w));
    describe(rankWith(riskHeavy).order[0], 'cf-risk-doubled', 'What if Cmdr. Worst Case had double the weight?', 'Paranoia has limits, apparently.');

    const irrelevantRow = AGENTS.findIndex((a) => a.id === 'irrelevant');
    const sciHeavy = weights.map((w, i) => (i === irrelevantRow ? w * 10 : w));
    describe(
      rankWith(sciHeavy).order[0],
      'cf-irrelevant-x10',
      'What if Irrelevant Science were ten times more important?',
      'This is how most internet arguments are settled.',
    );

    for (const a of order.slice(1)) {
      const deficit = round2(round2(aggregates[winner]) - round2(aggregates[a]));
      const objectors = AGENTS.filter((_, i) => scores[i][a] < scores[i][winner]).map((ag) => ag.name);
      out.push({
        id: `cf-choose-${alts[a].id}`,
        question: `What if you chose ${alts[a].label} anyway?`,
        answer: `You would forgo ${deficit.toFixed(2)} aggregate points (${((deficit / Math.max(aggregates[winner], 1)) * 100).toFixed(1)}% less satisfaction-units). ${objectors.length} specialist${objectors.length === 1 ? '' : 's'} would file formal complaints${objectors.length ? `, led by ${objectors[0]}` : ''}.`,
        flipsVerdict: false,
        newWinnerId: null,
      });
    }
    return out;
  }

  // Explanation of why the winner won.
  const explanation: string[] = [];
  const W = TOTAL_WEIGHT;
  const diffs = AGENTS.map((agent, i) => ({
    agent,
    diff: (agent.weight * (scores[i][winner] - scores[i][runnerUp])) / W,
  })).sort((x, y) => y.diff - x.diff);
  // Computed from the displayed (rounded) aggregates so every number in the UI agrees.
  const margin = round2(round2(aggregates[winner]) - round2(aggregates[runnerUp]));
  explanation.push(
    `${alts[winner].label} achieved the highest weighted aggregate: ${round2(aggregates[winner]).toFixed(2)} vs ${round2(aggregates[runnerUp]).toFixed(2)} for ${alts[runnerUp].label} (margin ${margin.toFixed(2)} points).`,
  );
  const helpers = diffs.filter((d) => d.diff > 0).slice(0, 3);
  if (helpers.length) {
    explanation.push(
      `Decisive advantage came from ${helpers.map((d) => `${d.agent.discipline} (+${d.diff.toFixed(2)})`).join(', ')}.`,
    );
  }
  const opponents = diffs.filter((d) => d.diff < 0).reverse().slice(0, 2);
  if (opponents.length) {
    explanation.push(
      `Strongest opposition: ${opponents.map((d) => `${d.agent.discipline} (${d.diff.toFixed(2)})`).join(', ')}, which favoured ${alts[runnerUp].label}.`,
    );
  }
  explanation.push(
    `${votes[winner]} of ${AGENTS.length} specialists voted for it. Votes are advisory; the weighted aggregate is binding.`,
  );
  if (tie.occurred) {
    const reason: Record<TieBreak, string> = {
      none: '',
      votes: 'more specialist votes',
      risk: 'a higher Risk directorate score',
      'sacred-hash': 'the Sacred Hash (a deterministic FNV-1a tiebreaker)',
    };
    explanation.push(
      `Aggregate tie between ${tie.tied.map((t) => alts[t].label).join(' and ')}, resolved by ${reason[tie.resolvedBy]}.`,
    );
  }
  explanation.push(
    pivotalAgentIds.length
      ? `Pivotal specialists (removing any one flips the verdict): ${pivotalAgentIds.map((id) => AGENTS.find((a) => a.id === id)!.name).join(', ')}.`
      : 'No single specialist is pivotal: the verdict survives the removal of any one of them.',
  );

  return {
    decision,
    features,
    agents,
    standings,
    winnerId: alts[winner].id,
    margin,
    tie: { occurred: tie.occurred, tiedIds: tie.tied.map((t) => alts[t].id), resolvedBy: tie.resolvedBy },
    agreement: votes[winner] / AGENTS.length,
    pivotalAgentIds,
    leaveOneOut,
    counterfactuals,
    flips,
    explanation,
    totalWeight: TOTAL_WEIGHT,
  };
}

/** Score matrix [agent][alternative] in decision.alternatives order. */
export function scoreMatrix(result: DecisionResult): number[][] {
  return result.agents.map((agent) => agent.scores.map((s) => s.score));
}
