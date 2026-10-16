import { useMemo, useState } from 'react';
import { getCommentaryProvider, houseCommentary } from '../commentary/provider';
import type { VerdictReport } from '../engine';

interface OfficialReportProps {
  verdict: VerdictReport;
  simRunning: boolean;
  copyStatus: string;
  onCopy: () => void;
}

export function OfficialReport({ verdict, simRunning, copyStatus, onCopy }: OfficialReportProps) {
  const provider = useMemo(() => getCommentaryProvider(), []);
  const [ai, setAi] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text: string }>({ status: 'idle', text: '' });

  const requestAi = async () => {
    setAi({ status: 'loading', text: '' });
    try {
      const text = await provider.generate(verdict);
      setAi({ status: 'done', text });
    } catch (err) {
      setAi({ status: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const sim = verdict.simulation;

  return (
    <section id="report" className="panel section report" aria-labelledby="report-title">
      <div className="sticker sticker-hot">EXHIBIT Z · FINAL</div>
      <div className="report-paper">
        <header className="report-head">
          <div className="seal" aria-hidden="true">
            <span>SUPREME</span>
            <span className="seal-mid">⚖</span>
            <span>COUNCIL</span>
          </div>
          <div>
            <p className="report-org">The Supreme Council of Overthinking · Bureau of Trivial Affairs</p>
            <h2 id="report-title" className="report-title">Official Verdict &amp; Findings</h2>
            <p className="report-case">Case No. {verdict.caseNumber}</p>
          </div>
        </header>

        <p className="report-matter">
          <strong>In the matter of:</strong> “{verdict.dilemma}”
        </p>

        <div className="report-section">
          <h3>§1 Selected alternative</h3>
          <p className="report-winner">{verdict.winnerLabel}</p>
          <p>
            Aggregate score <strong>{verdict.aggregate.toFixed(2)} / 100</strong>, margin {verdict.confidence.margin.toFixed(2)} points.
          </p>
        </div>

        <div className="report-section">
          <h3>§2 Confidence (described accurately)</h3>
          <p>
            <strong>{verdict.confidence.label}.</strong> {verdict.confidence.description}
          </p>
        </div>

        <div className="report-section">
          <h3>§3 Simulated win frequency</h3>
          {sim.available ? (
            <p>
              Won <strong>{(sim.winFrequency! * 100).toFixed(1)}%</strong> (± {(sim.moe! * 100).toFixed(2)}% Monte Carlo sampling error)
              of {sim.iterations!.toLocaleString()} perturbed scenarios. This describes sensitivity to the engine’s own made-up
              parameters, not a real-world probability.
            </p>
          ) : (
            <p className="hint">{simRunning ? 'Simulation in progress… this section will update automatically.' : 'Simulation not completed. Run it in Exhibit D.'}</p>
          )}
        </div>

        <div className="report-section">
          <h3>§4 Rejected alternatives</h3>
          <ul className="rejected-list">
            {verdict.rejected.map((r) => (
              <li key={r.label}>
                <strong>✗ {r.label}</strong> ({r.aggregate.toFixed(2)}) — {r.reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="report-section">
          <h3>§5 Risk assessment</h3>
          <p>
            <span className={`risk-pill risk-${verdict.risk.level.replace(/\s/g, '').toLowerCase()}`}>{verdict.risk.level}</span>{' '}
            {verdict.risk.text}
          </p>
        </div>

        <div className="report-section">
          <h3>§6 Reasoning of the Council</h3>
          <ol>
            {verdict.reasoning.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>

        <div className="report-section">
          <h3>§7 Counterfactual reasoning</h3>
          <ul>
            {verdict.counterfactuals.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>

        <div className="decree">
          <h3>Official Decree</h3>
          <p>{verdict.decree}</p>
          <div className="signatures" aria-hidden="true">
            <span>Dr. Paisa Vasool</span>
            <span>Cmdr. Worst Case</span>
            <span>The Infinite Subcommittee</span>
          </div>
        </div>

        <div className="commentary">
          <h3>Press commentary</h3>
          <p>{houseCommentary(verdict)}</p>
          <p className="hint">
            Template commentary, generated deterministically. No AI involved. AI commentary:{' '}
            <strong>{provider.enabled ? `enabled via ${provider.label}` : 'disabled (optional, see README)'}</strong>.
          </p>
          {provider.enabled && (
            <div className="ai-box">
              <button className="btn btn-small" onClick={requestAi} disabled={ai.status === 'loading'}>
                {ai.status === 'loading' ? 'Consulting the oracle…' : 'Request AI commentary'}
              </button>
              {ai.status === 'done' && <blockquote>{ai.text}</blockquote>}
              {ai.status === 'error' && (
                <p className="field-error" role="alert">
                  AI commentary unavailable ({ai.text}). The template commentary above remains authoritative.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="disclaimer">
          <strong>Disclaimer:</strong> {verdict.disclaimer}
        </p>

        <div className="report-actions">
          <button className="btn btn-primary" onClick={onCopy}>
            📋 Copy full verdict
          </button>
          <span className="copy-status" role="status" aria-live="polite">
            {copyStatus}
          </span>
        </div>
      </div>
    </section>
  );
}
