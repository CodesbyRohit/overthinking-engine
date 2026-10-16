import { describe, expect, it } from 'vitest';
import {
  AGENTS,
  aggregateScores,
  analyze,
  buildDecisionTree,
  buildVerdict,
  evaluateDecision,
  extractAlternatives,
  flipMultiplier,
  formatVerdictText,
  LIMITS,
  normalizeDecision,
  NOTHING_LABEL,
  PRESETS,
  rankAlternatives,
  walkTree,
  type DecisionResult,
} from './index';

function mustAnalyze(dilemma: string, alternatives?: string[]): DecisionResult {
  const r = analyze({ dilemma, alternatives });
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join('; '));
  return r.result;
}

describe('normalization & validation', () => {
  it('extracts alternatives and factors out a shared verb', () => {
    const { segments, sharedVerb } = extractAlternatives('Should I order samosa or vada pav?');
    expect(segments).toEqual(['samosa', 'vada pav']);
    expect(sharedVerb).toBe('order');
  });

  it('keeps verbs when every alternative has its own', () => {
    const { segments, sharedVerb } = extractAlternatives('Should I close all 47 browser tabs or keep them open?');
    expect(segments).toEqual(['close all 47 browser tabs', 'keep them open']);
    expect(sharedVerb).toBeNull();
  });

  it('handles comma lists, "vs" and "between ... and"', () => {
    expect(extractAlternatives('the black hoodie, the blue kurta or the neon shirt').segments).toHaveLength(3);
    expect(extractAlternatives('Pizza vs biryani').segments).toEqual(['Pizza', 'biryani']);
    expect(extractAlternatives("I can't decide between tea and coffee").segments).toEqual(['tea', 'coffee']);
  });

  it('rejects empty and whitespace-only dilemmas', () => {
    for (const dilemma of ['', '   ', '\n\t']) {
      const r = normalizeDecision({ dilemma });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues[0].field).toBe('dilemma');
    }
  });

  it('rejects excessively long dilemmas and alternatives', () => {
    const r = normalizeDecision({ dilemma: 'a'.repeat(LIMITS.dilemmaMax + 1) });
    expect(r.ok).toBe(false);
    const r2 = normalizeDecision({ dilemma: 'Lunch?', alternatives: ['x'.repeat(LIMITS.alternativeMax + 1), 'y'] });
    expect(r2.ok).toBe(false);
    const r3 = normalizeDecision({ dilemma: 'Lunch?', alternatives: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(r3.ok).toBe(false);
  });

  it('fills a missing alternative with "do absolutely nothing"', () => {
    const r = normalizeDecision({ dilemma: 'Should I send the long text message to my ex?' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision.alternatives).toHaveLength(2);
    expect(r.decision.alternatives[1].label).toBe(NOTHING_LABEL);
    expect(r.decision.alternatives[1].synthetic).toBe(true);
  });

  it('treats a dilemma without alternatives as yes/no', () => {
    const r = normalizeDecision({ dilemma: 'Should I?' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decision.alternatives.map((a) => a.label)).toEqual(['Yes, do it', 'No, do not']);
  });

  it('gives open-ended questions two synthetic options', () => {
    const r = normalizeDecision({ dilemma: 'What should I eat for dinner?' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decision.alternatives.every((a) => a.synthetic)).toBe(true);
  });

  it('merges duplicate alternatives case-insensitively', () => {
    const r = normalizeDecision({ dilemma: 'Food?', alternatives: ['Dosa', 'dosa ', 'DOSA', 'Idli'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decision.alternatives.map((a) => a.label)).toEqual(['Dosa', 'Idli']);
  });

  it('prefers custom alternatives over extraction and ignores blanks', () => {
    const r = normalizeDecision({ dilemma: 'Should I order samosa or vada pav?', alternatives: ['Poha', '', '  ', 'Upma'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decision.alternatives.map((a) => a.label)).toEqual(['Poha', 'Upma']);
  });
});

describe('scoring engine', () => {
  const result = mustAnalyze('Should I order samosa or vada pav?');

  it('has twelve distinct specialists with positive weights', () => {
    expect(AGENTS).toHaveLength(12);
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(12);
    expect(AGENTS.every((a) => a.weight > 0)).toBe(true);
    expect(result.agents).toHaveLength(12);
  });

  it('every agent produces bounded scores, factors, explanation, vote and objection', () => {
    for (const agent of result.agents) {
      expect(agent.scores).toHaveLength(2);
      for (const s of agent.scores) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
        expect(s.explanation.length).toBeGreaterThan(0);
        expect(s.factors.length).toBeGreaterThan(0);
      }
      expect(result.decision.alternatives.map((a) => a.id)).toContain(agent.voteId);
      expect(agent.objection.text.length).toBeGreaterThan(0);
    }
  });

  it('factor points reproduce each score (transparent scoring)', () => {
    for (const agent of result.agents) {
      for (const s of agent.scores) {
        const sum = s.factors.reduce((t, f) => t + f.points, 0);
        const clamped = Math.min(100, Math.max(0, sum));
        expect(Math.abs(clamped - s.score)).toBeLessThan(0.5);
      }
    }
  });

  it('aggregate equals the documented weighted mean and contributions sum to it', () => {
    result.decision.alternatives.forEach((alt, a) => {
      const expected =
        result.agents.reduce((s, ag) => s + ag.weight * ag.scores[a].score, 0) / result.agents.reduce((s, ag) => s + ag.weight, 0);
      const standing = result.standings.find((s) => s.alternativeId === alt.id)!;
      expect(standing.aggregate).toBeCloseTo(expected, 2);
      const contributions = result.agents.reduce((s, ag) => s + ag.scores[a].contribution, 0);
      expect(contributions).toBeCloseTo(expected, 0);
    });
  });

  it('selects the alternative with the highest aggregate and explains why', () => {
    const top = [...result.standings].sort((x, y) => y.aggregate - x.aggregate)[0];
    expect(result.winnerId).toBe(top.alternativeId);
    expect(result.standings[0].alternativeId).toBe(result.winnerId);
    expect(result.explanation[0]).toContain(top.label);
    expect(result.margin).toBeCloseTo(result.standings[0].aggregate - result.standings[1].aggregate, 1);
  });

  it('votes sum to the number of agents', () => {
    expect(result.standings.reduce((s, st) => s + st.votes, 0)).toBe(12);
  });

  it('flip analysis multiplier actually flips the verdict', () => {
    const scores = result.agents.map((a) => a.scores.map((s) => s.score));
    const weights = result.agents.map((a) => a.weight);
    for (const flip of result.flips) {
      if (flip.multiplier === null) continue;
      const a = result.decision.alternatives.findIndex((x) => x.id === flip.alternativeId);
      const j = result.agents.findIndex((x) => x.agentId === flip.agentId);
      const boosted = weights.map((w, i) => (i === j ? w * flip.multiplier! : w));
      const agg = aggregateScores(scores, boosted);
      expect(agg[a]).toBe(Math.max(...agg));
    }
  });

  it('works for every preset', () => {
    for (const p of PRESETS) {
      const r = mustAnalyze(p.dilemma, p.alternatives);
      expect(r.standings.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('reproducibility', () => {
  it('identical inputs produce identical results', () => {
    const a = mustAnalyze('Should I wear the black hoodie, the blue kurta or the neon shirt?');
    const b = mustAnalyze('Should I wear the black hoodie, the blue kurta or the neon shirt?');
    expect(a).toEqual(b);
  });

  it('the order of alternatives does not change scores or the winner', () => {
    const a = mustAnalyze('Dinner?', ['Biryani', 'Dosa', 'Salad']);
    const b = mustAnalyze('Dinner?', ['Salad', 'Biryani', 'Dosa']);
    const winnerLabel = (r: DecisionResult) => r.standings[0].label;
    expect(winnerLabel(a)).toBe(winnerLabel(b));
    const byLabel = (r: DecisionResult) => Object.fromEntries(r.standings.map((s) => [s.label, s.aggregate]));
    expect(byLabel(a)).toEqual(byLabel(b));
  });
});

describe('ties', () => {
  it('breaks aggregate ties by votes first', () => {
    const r = rankAlternatives({ aggregates: [50, 50, 40], votes: [3, 7, 2], riskScores: [90, 10, 50], hashes: [1, 2, 3] });
    expect(r.order[0]).toBe(1);
    expect(r.tie).toEqual({ occurred: true, tied: [1, 0], resolvedBy: 'votes' });
  });

  it('then by risk score', () => {
    const r = rankAlternatives({ aggregates: [50, 50], votes: [6, 6], riskScores: [40, 80], hashes: [1, 2] });
    expect(r.order[0]).toBe(1);
    expect(r.tie.resolvedBy).toBe('risk');
  });

  it('then by the Sacred Hash, deterministically', () => {
    const r = rankAlternatives({ aggregates: [50, 50], votes: [6, 6], riskScores: [80, 80], hashes: [99, 5] });
    expect(r.order[0]).toBe(1);
    expect(r.tie.resolvedBy).toBe('sacred-hash');
  });

  it('treats differences below 0.005 as ties and larger ones as decisive', () => {
    expect(rankAlternatives({ aggregates: [50.001, 50.003], votes: [1, 0], riskScores: [0, 0], hashes: [0, 0] }).tie.occurred).toBe(true);
    const clear = rankAlternatives({ aggregates: [50.2, 50.1], votes: [0, 12], riskScores: [0, 0], hashes: [0, 0] });
    expect(clear.tie.occurred).toBe(false);
    expect(clear.order[0]).toBe(0);
  });

  it('flipMultiplier returns null when the agent cannot help', () => {
    // Agent 0 prefers alternative 0; alternative 1 cannot win via agent 0.
    expect(flipMultiplier([[80, 20], [10, 30]], [1, 1], 1, 0)).toBeNull();
    const k = flipMultiplier([[80, 20], [10, 30]], [1, 1], 1, 1)!;
    // 0 wins (90 vs 50). Boosting agent 1 by k: 80+10k vs 20+30k → k > 3.
    expect(k).toBeCloseTo(3, 6);
  });
});

describe('decision tree', () => {
  const result = mustAnalyze('Should I order samosa or vada pav?');
  const tree = buildDecisionTree(result, null);

  it('contains every alternative, including the rejected ones', () => {
    const altNodes = tree.children.filter((c) => c.kind === 'alternative');
    expect(altNodes).toHaveLength(2);
    expect(altNodes.filter((n) => n.status === 'winner')).toHaveLength(1);
    expect(altNodes.filter((n) => n.status === 'rejected')).toHaveLength(1);
  });

  it('has one criterion per specialist and unique node ids', () => {
    const ids = new Set<string>();
    let criteria = 0;
    walkTree(tree, (n) => {
      expect(ids.has(n.id)).toBe(false);
      ids.add(n.id);
      if (n.kind === 'criterion') criteria++;
    });
    expect(criteria).toBe(12 * 2);
  });

  it('leave-one-out branches match the engine', () => {
    const winnerNode = tree.children.find((c) => c.status === 'winner')!;
    const robust = winnerNode.children.find((c) => c.id.endsWith('-whatif'))!;
    expect(robust.children).toHaveLength(12);
    expect(robust.children.filter((c) => c.status === 'flip')).toHaveLength(result.pivotalAgentIds.length);
  });
});

describe('verdict', () => {
  it('names the winner, rejected options and the disclaimer', () => {
    const result = mustAnalyze('Should I close all 47 browser tabs or keep them open?');
    const v = buildVerdict(result, null);
    const winner = result.standings[0].label;
    expect(v.winnerLabel).toBe(winner);
    expect(v.rejected).toHaveLength(1);
    expect(v.decree).toContain(winner.toUpperCase());
    const text = formatVerdictText(v);
    expect(text).toContain(winner.toUpperCase());
    expect(text).toMatch(/entertainment/i);
    expect(v.confidence.index).toBeGreaterThanOrEqual(0);
    expect(v.confidence.index).toBeLessThanOrEqual(100);
  });
});

describe('evaluateDecision directly', () => {
  it('handles six alternatives', () => {
    const r = normalizeDecision({ dilemma: 'Lunch?', alternatives: ['Dosa', 'Idli', 'Poha', 'Upma', 'Misal', 'Thali'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const res = evaluateDecision(r.decision);
    expect(res.standings).toHaveLength(6);
    expect(res.flips).toHaveLength(5);
  });
});
