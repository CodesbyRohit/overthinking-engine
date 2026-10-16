import type { DecisionResult, VerdictReport } from '../engine';
import { altColor } from '../lib/colors';
import type { SimulationState } from '../lib/useSimulation';

interface VerdictHeroProps {
  result: DecisionResult;
  verdict: VerdictReport;
  sim: SimulationState;
  copyStatus: string;
  onCopy: () => void;
  onEdit: () => void;
  onReset: () => void;
}

export function VerdictHero({ result, verdict, sim, copyStatus, onCopy, onEdit, onReset }: VerdictHeroProps) {
  const winnerIdx = result.decision.alternatives.findIndex((a) => a.id === result.winnerId);
  const simText =
    sim.status === 'done' && verdict.simulation.winFrequency !== null
      ? `${(verdict.simulation.winFrequency * 100).toFixed(1)}%`
      : sim.status === 'running'
        ? `${sim.total ? Math.round((sim.completed / sim.total) * 100) : 0}%…`
        : '—';

  return (
    <section className="verdict-hero panel" aria-labelledby="verdict-hero-title" style={{ ['--alt' as string]: altColor(winnerIdx) }}>
      <div className="hero-case">
        CASE {verdict.caseNumber} · “{result.decision.dilemma}”
      </div>
      <p className="hero-kicker">After exhaustive and frankly unnecessary deliberation, the Council has selected</p>
      <h2 id="verdict-hero-title" className="hero-winner">
        {verdict.winnerLabel}
      </h2>
      <div className="stamp" aria-hidden="true">
        DECIDED
      </div>
      <dl className="hero-stats">
        <div>
          <dt>Aggregate score</dt>
          <dd>{verdict.aggregate.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Consensus index</dt>
          <dd>
            {verdict.confidence.index}
            <small>/100</small>
          </dd>
        </div>
        <div>
          <dt>Specialist votes</dt>
          <dd>
            {result.standings[0].votes}
            <small>/12</small>
          </dd>
        </div>
        <div>
          <dt>Simulated win frequency</dt>
          <dd>{simText}</dd>
        </div>
        <div>
          <dt>Risk level</dt>
          <dd className={`risk-${verdict.risk.level.replace(/\s/g, '').toLowerCase()}`}>{verdict.risk.level}</dd>
        </div>
      </dl>
      {result.tie.occurred && (
        <p className="hero-tie">
          ⚖ Photo finish! Tie resolved by{' '}
          {result.tie.resolvedBy === 'sacred-hash' ? 'the Sacred Hash' : result.tie.resolvedBy === 'votes' ? 'specialist votes' : 'the Risk directorate'}.
        </p>
      )}
      <div className="hero-actions">
        <button className="btn btn-primary" onClick={onCopy}>
          📋 Copy verdict
        </button>
        <button className="btn" onClick={onEdit}>
          ✎ Edit dilemma
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          ↺ Reset everything
        </button>
        <span className="copy-status" role="status" aria-live="polite">
          {copyStatus}
        </span>
      </div>
      <nav className="section-nav" aria-label="Report sections">
        <a href="#council">Council</a>
        <a href="#scoreboard">Scoreboard</a>
        <a href="#tree">Decision tree</a>
        <a href="#montecarlo">Monte Carlo</a>
        <a href="#report">Official report</a>
      </nav>
    </section>
  );
}
