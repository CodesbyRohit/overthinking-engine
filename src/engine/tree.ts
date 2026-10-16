import type { SimulationResult } from './simulation';
import type { DecisionResult } from './types';

export type TreeNodeKind = 'root' | 'alternative' | 'group' | 'criterion' | 'factor' | 'counterfactual' | 'simulation';
export type TreeStatus = 'winner' | 'rejected' | 'support' | 'oppose' | 'flip' | 'stable' | 'neutral';

export interface TreeNode {
  id: string;
  kind: TreeNodeKind;
  label: string;
  /** Short value shown next to the label (e.g. a score). */
  badge?: string;
  detail?: string;
  metrics?: { label: string; value: string }[];
  status?: TreeStatus;
  children: TreeNode[];
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Build the inspectable decision tree. Every node is derived from the
 * DecisionResult (and SimulationResult, when available); nothing is decorative.
 */
export function buildDecisionTree(result: DecisionResult, sim: SimulationResult | null): TreeNode {
  const alts = result.decision.alternatives;
  const byId = Object.fromEntries(alts.map((a) => [a.id, a]));
  const winnerIdx = alts.findIndex((a) => a.id === result.winnerId);
  const agentName = (id: string) => result.agents.find((a) => a.agentId === id)?.name ?? id;

  const altNodes: TreeNode[] = result.standings.map((standing) => {
    const altIdx = alts.findIndex((a) => a.id === standing.alternativeId);
    const isWinner = standing.alternativeId === result.winnerId;
    const prefix = `n-${standing.alternativeId}`;

    const criteria: TreeNode[] = result.agents.map((agent) => {
      const s = agent.scores[altIdx];
      const ws = agent.scores[winnerIdx];
      const delta = s.score - ws.score;
      return {
        id: `${prefix}-crit-${agent.agentId}`,
        kind: 'criterion',
        label: `${agent.glyph} ${agent.discipline}`,
        badge: s.score.toFixed(1),
        detail: `${agent.name}: ${s.explanation}`,
        status: agent.voteId === standing.alternativeId ? 'support' : agent.objection.alternativeId === standing.alternativeId ? 'oppose' : 'neutral',
        metrics: [
          { label: 'Score', value: s.score.toFixed(1) },
          { label: 'Weight', value: `${agent.weight} (${pct(agent.weightShare)})` },
          { label: 'Points contributed', value: s.contribution.toFixed(2) },
          ...(isWinner ? [] : [{ label: 'vs winner', value: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` }]),
          { label: 'Vote', value: agent.voteId === standing.alternativeId ? 'FOR' : 'not for' },
        ],
        children: s.factors.map((f, i) => ({
          id: `${prefix}-crit-${agent.agentId}-f${i}`,
          kind: 'factor' as const,
          label: f.label,
          badge: `${f.points >= 0 ? '+' : ''}${f.points}`,
          detail: f.value,
          status: f.label === 'Baseline' ? ('neutral' as const) : f.points >= 0 ? ('support' as const) : ('oppose' as const),
          children: [],
        })),
      };
    });

    const whatIfs: TreeNode[] = [];
    if (isWinner) {
      for (const loo of result.leaveOneOut) {
        const flips = loo.winnerId !== result.winnerId;
        whatIfs.push({
          id: `${prefix}-loo-${loo.agentId}`,
          kind: 'counterfactual',
          label: `What if ${agentName(loo.agentId)} stayed home?`,
          badge: flips ? 'FLIPS' : 'holds',
          status: flips ? 'flip' : 'stable',
          detail: flips
            ? `Without this specialist, ${byId[loo.winnerId].label} would win. This specialist is pivotal.`
            : `${standing.label} still wins without this specialist.`,
          children: [],
        });
      }
    } else {
      const cf = result.counterfactuals.find((c) => c.id === `cf-choose-${standing.alternativeId}`);
      if (cf) {
        whatIfs.push({ id: `${prefix}-choose`, kind: 'counterfactual', label: cf.question, status: 'rejected', detail: cf.answer, children: [] });
      }
      const flip = result.flips.find((f) => f.alternativeId === standing.alternativeId);
      if (flip) {
        whatIfs.push({
          id: `${prefix}-flip`,
          kind: 'counterfactual',
          label: 'What would it take to win?',
          badge: flip.multiplier ? `×${flip.multiplier.toFixed(2)}` : 'impossible',
          status: flip.multiplier ? 'flip' : 'stable',
          detail: flip.multiplier
            ? `Multiply ${agentName(flip.agentId!)}'s weight by ${flip.multiplier.toFixed(2)} and ${standing.label} wins (currently trails by ${flip.deficit.toFixed(2)} points).`
            : `No single specialist's weight can make ${standing.label} win: nobody prefers it over every rival. Mathematically doomed.`,
          children: [],
        });
      }
    }

    const children: TreeNode[] = [
      {
        id: `${prefix}-criteria`,
        kind: 'group',
        label: 'Specialist criteria',
        badge: `${standing.votes} vote${standing.votes === 1 ? '' : 's'}`,
        detail: 'Each specialist scores this alternative from 0 to 100 using its documented rule.',
        children: criteria,
      },
      {
        id: `${prefix}-whatif`,
        kind: 'group',
        label: isWinner ? 'Robustness checks (leave-one-out)' : 'Counterfactual outcomes',
        badge: `${whatIfs.length}`,
        children: whatIfs,
      },
    ];

    if (sim) {
      const st = sim.stats[standing.alternativeId];
      children.push({
        id: `${prefix}-sim`,
        kind: 'simulation',
        label: 'Monte Carlo outcome',
        badge: pct(sim.winFrequency[standing.alternativeId] ?? 0),
        detail: `Won ${sim.wins[standing.alternativeId]} of ${sim.iterations.toLocaleString()} perturbed scenarios.`,
        metrics: [
          { label: 'Win frequency', value: `${pct(sim.winFrequency[standing.alternativeId])} ± ${pct(sim.winFrequencyMoe[standing.alternativeId])}` },
          { label: 'Mean simulated score', value: st.mean.toFixed(2) },
          { label: '5th–95th percentile', value: `${st.p5.toFixed(1)} – ${st.p95.toFixed(1)}` },
        ],
        status: isWinner ? 'winner' : 'neutral',
        children: [],
      });
    }

    return {
      id: prefix,
      kind: 'alternative',
      label: `#${standing.rank} ${standing.label}`,
      badge: standing.aggregate.toFixed(2),
      status: isWinner ? 'winner' : 'rejected',
      detail: isWinner ? 'Selected by the Council.' : `Rejected. Trails the winner by ${(result.standings[0].aggregate - standing.aggregate).toFixed(2)} points.`,
      metrics: [
        { label: 'Aggregate', value: standing.aggregate.toFixed(2) },
        { label: 'Votes', value: `${standing.votes} / ${result.agents.length}` },
        { label: 'Rank', value: `${standing.rank} of ${result.standings.length}` },
        ...(byId[standing.alternativeId].synthetic ? [{ label: 'Origin', value: 'Invented by the engine' }] : []),
      ],
      children,
    };
  });

  const globalNode: TreeNode = {
    id: 'n-global',
    kind: 'group',
    label: 'Global “what if” scenarios',
    badge: `${result.counterfactuals.filter((c) => !c.id.startsWith('cf-choose')).length}`,
    children: result.counterfactuals
      .filter((c) => !c.id.startsWith('cf-choose'))
      .map((c) => ({
        id: `n-${c.id}`,
        kind: 'counterfactual' as const,
        label: c.question,
        badge: c.flipsVerdict ? 'FLIPS' : 'holds',
        status: c.flipsVerdict ? ('flip' as const) : ('stable' as const),
        detail: c.answer,
        children: [],
      })),
  };

  return {
    id: 'n-root',
    kind: 'root',
    label: result.decision.dilemma,
    badge: `${alts.length} options`,
    detail: result.decision.notes.join(' ') || 'Alternatives extracted directly from the dilemma.',
    children: [...altNodes, globalNode],
  };
}

/** Flatten helper used by tests and keyboard navigation. */
export function walkTree(node: TreeNode, visit: (n: TreeNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const child of node.children) walkTree(child, visit, depth + 1);
}
