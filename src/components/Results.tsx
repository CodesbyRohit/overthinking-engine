import type { DecisionResult, SimulationConfig, SimulationResult, VerdictReport } from '../engine';
import type { SimulationState } from '../lib/useSimulation';
import { AgentCouncil } from './AgentCouncil';
import { DecisionTreeView } from './DecisionTreeView';
import { MonteCarloPanel } from './MonteCarloPanel';
import { OfficialReport } from './OfficialReport';
import { Scoreboard } from './Scoreboard';
import { VerdictHero } from './VerdictHero';

export interface ResultsProps {
  result: DecisionResult;
  verdict: VerdictReport;
  sim: SimulationState & { run: (cfg?: SimulationConfig) => void; cancel: () => void };
  finishedSim: SimulationResult | null;
  simConfig: SimulationConfig;
  onSimConfigChange: (cfg: SimulationConfig) => void;
  copyStatus: string;
  onCopy: () => void;
  onEdit: () => void;
  onReset: () => void;
}

/** Everything shown after deliberation. Lazy-loaded so charts don't weigh down the intake screen. */
export default function Results({ result, verdict, sim, finishedSim, simConfig, onSimConfigChange, copyStatus, onCopy, onEdit, onReset }: ResultsProps) {
  return (
    <div className="results">
      <VerdictHero result={result} verdict={verdict} sim={sim} copyStatus={copyStatus} onCopy={onCopy} onEdit={onEdit} onReset={onReset} />
      <AgentCouncil result={result} />
      <Scoreboard result={result} />
      <DecisionTreeView result={result} sim={finishedSim} />
      <MonteCarloPanel result={result} sim={sim} config={simConfig} onConfigChange={onSimConfigChange} />
      <OfficialReport verdict={verdict} simRunning={sim.status === 'running'} copyStatus={copyStatus} onCopy={onCopy} />
      <div className="again">
        <button className="btn btn-analyze" onClick={onEdit}>
          <span>OVERTHINK SOMETHING ELSE</span>
          <small>your current dilemma text is kept</small>
        </button>
      </div>
    </div>
  );
}
