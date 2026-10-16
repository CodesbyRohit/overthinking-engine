import { hashString, pickBy } from './rng';
import type { SimulationResult } from './simulation';
import type { DecisionResult } from './types';

export interface VerdictReport {
  caseNumber: string;
  dilemma: string;
  winnerId: string;
  winnerLabel: string;
  aggregate: number;
  confidence: {
    /** 0..100 Internal Consensus Index. */
    index: number;
    label: string;
    agreement: number;
    margin: number;
    description: string;
  };
  simulation: {
    available: boolean;
    winFrequency: number | null;
    moe: number | null;
    iterations: number | null;
    upsetRate: number | null;
  };
  rejected: { label: string; aggregate: number; reason: string }[];
  risk: { level: 'Negligible' | 'Moderate' | 'Elevated' | 'DEFCON 1'; score: number; text: string };
  counterfactuals: string[];
  reasoning: string[];
  decree: string;
  disclaimer: string;
}

const DECREES = [
  'BY ORDER OF THE SUPREME COUNCIL OF OVERTHINKING, it is hereby decreed that {W} shall be chosen forthwith. Any further deliberation on this matter is punishable by being asked "are you sure?" forty-seven times.',
  'WHEREAS twelve specialists have deliberated for longer than the decision deserved, and WHEREAS the spreadsheets are now load-bearing, the Council DECLARES {W} the lawful and binding choice of this petitioner, effective immediately and retroactively.',
  'LET IT BE KNOWN across all seven suburbs and the Western line that {W} has prevailed. The rejected alternatives are to be remembered fondly but never spoken of at dinner.',
  'IN THE NAME OF SCIENCE (loosely defined), the Council ORDERS the petitioner to proceed with {W}. Appeals may be filed in triplicate with the Infinite Subcommittee, which meets never.',
  'THE MATTER IS SETTLED. {W} is chosen. Second-guessing is now classified as a Class-B Overthinking Offence under Section 404 of the Indecision Act, 2026.',
];

export const DISCLAIMER =
  'This verdict was produced by twelve hand-written deterministic heuristics and a Monte Carlo simulation of those same heuristics. It is entertainment, not validated decision science, financial, medical, nutritional or romantic advice. Confidence and win-frequency figures measure the internal consistency and parameter sensitivity of a joke model; they are not probabilities that this choice is correct.';

export function buildVerdict(result: DecisionResult, sim: SimulationResult | null): VerdictReport {
  const alts = result.decision.alternatives;
  const winner = alts.find((a) => a.id === result.winnerId)!;
  const winnerIdx = alts.indexOf(winner);
  const top = result.standings[0];

  // Internal Consensus Index: half agent agreement, half margin (saturating at 10 points).
  const marginPart = Math.min(1, result.margin / 10);
  const index = Math.round((0.5 * result.agreement + 0.5 * marginPart) * 100);
  const label =
    index >= 75 ? 'Overwhelming (suspiciously so)' : index >= 50 ? 'Firm' : index >= 30 ? 'Wobbly' : 'Coin-flip territory';

  const riskAgent = result.agents.find((a) => a.agentId === 'risk')!;
  const riskScore = riskAgent.scores[winnerIdx].score;
  const upsetRate = sim ? sim.upsets / sim.iterations : null;
  const level: VerdictReport['risk']['level'] =
    riskScore >= 75 ? 'Negligible' : riskScore >= 55 ? 'Moderate' : riskScore >= 35 ? 'Elevated' : 'DEFCON 1';
  const riskFactors = riskAgent.scores[winnerIdx].factors.filter((f) => f.label !== 'Baseline' && f.points < 0).map((f) => f.label.toLowerCase());
  const riskText = `${riskAgent.name} rates ${winner.label} at ${riskScore.toFixed(1)}/100 for safety${riskFactors.length ? `, citing ${riskFactors.join(', ')}` : ', citing nothing specific but remaining uneasy'}.${upsetRate !== null ? ` Under perturbation, the verdict was overturned in ${(upsetRate * 100).toFixed(1)}% of simulated scenarios.` : ''}`;

  const rejected = result.standings.slice(1).map((s) => {
    const flip = result.flips.find((f) => f.alternativeId === s.alternativeId);
    const objectors = result.agents.filter((a) => a.objection.alternativeId === s.alternativeId);
    const loudest = objectors[0];
    let reason = `Trailed by ${(top.aggregate - s.aggregate).toFixed(2)} points with ${s.votes} vote${s.votes === 1 ? '' : 's'}.`;
    if (loudest) reason += ` ${loudest.objection.text}`;
    if (flip?.multiplier && flip.agentId) {
      const ag = result.agents.find((a) => a.agentId === flip.agentId)!;
      reason += ` Would need ${ag.discipline} weighted ×${flip.multiplier.toFixed(2)} to win.`;
    } else if (flip) {
      reason += ' No single specialist could rescue it.';
    }
    return { label: s.label, aggregate: s.aggregate, reason };
  });

  const counterfactuals = result.counterfactuals.filter((c) => !c.id.startsWith('cf-choose')).map((c) => `${c.question} ${c.answer}`);
  const pivotal = result.pivotalAgentIds.map((id) => result.agents.find((a) => a.agentId === id)!.name);
  counterfactuals.push(
    pivotal.length
      ? `Removing ${pivotal.join(' or ')} alone would flip the verdict.`
      : 'Removing any single specialist would not change the verdict.',
  );

  const decree = pickBy(DECREES, result.decision.canonicalKey).replace('{W}', winner.label.toUpperCase());
  const caseNumber = `OE-2026-${hashString(result.decision.canonicalKey).toString(16).toUpperCase().padStart(8, '0')}`;

  return {
    caseNumber,
    dilemma: result.decision.dilemma,
    winnerId: winner.id,
    winnerLabel: winner.label,
    aggregate: top.aggregate,
    confidence: {
      index,
      label,
      agreement: result.agreement,
      margin: result.margin,
      description: `Internal Consensus Index ${index}/100: ${Math.round(result.agreement * result.agents.length)} of ${result.agents.length} specialists voted for this option and it leads by ${result.margin.toFixed(2)} points. This measures agreement inside a joke model, not the probability that the choice is right.`,
    },
    simulation: {
      available: sim !== null,
      winFrequency: sim ? sim.winFrequency[winner.id] : null,
      moe: sim ? sim.winFrequencyMoe[winner.id] : null,
      iterations: sim ? sim.iterations : null,
      upsetRate,
    },
    rejected,
    risk: { level, score: riskScore, text: riskText },
    counterfactuals,
    reasoning: result.explanation,
    decree,
    disclaimer: DISCLAIMER,
  };
}

/** Plain-text rendering used by the copy-verdict button. */
export function formatVerdictText(v: VerdictReport): string {
  const line = '═'.repeat(48);
  const lines = [
    line,
    'THE OVERTHINKING ENGINE · OFFICIAL VERDICT',
    `Case ${v.caseNumber}`,
    line,
    `Dilemma: ${v.dilemma}`,
    '',
    `SELECTED: ${v.winnerLabel.toUpperCase()}`,
    `Aggregate score: ${v.aggregate.toFixed(2)} / 100`,
    `Confidence: ${v.confidence.label} (Internal Consensus Index ${v.confidence.index}/100)`,
    v.simulation.available
      ? `Simulated win frequency: ${(v.simulation.winFrequency! * 100).toFixed(1)}% ± ${(v.simulation.moe! * 100).toFixed(1)}% of ${v.simulation.iterations!.toLocaleString()} perturbed scenarios`
      : 'Simulated win frequency: simulation not completed',
    `Risk: ${v.risk.level}. ${v.risk.text}`,
    '',
    'Rejected alternatives:',
    ...v.rejected.map((r) => `  ✗ ${r.label} (${r.aggregate.toFixed(2)}): ${r.reason}`),
    '',
    'Why it won:',
    ...v.reasoning.map((r) => `  • ${r}`),
    '',
    'Counterfactuals:',
    ...v.counterfactuals.map((c) => `  ? ${c}`),
    '',
    'DECREE:',
    v.decree,
    '',
    `Disclaimer: ${v.disclaimer}`,
    line,
  ];
  return lines.join('\n');
}
