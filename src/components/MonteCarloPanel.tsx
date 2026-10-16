import { useEffect, useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DEFAULT_SIM_CONFIG, ITERATION_OPTIONS, validateConfig, type DecisionResult, type SimulationConfig } from '../engine';
import { altColor, CHART } from '../lib/colors';
import type { SimulationState } from '../lib/useSimulation';

interface MonteCarloPanelProps {
  result: DecisionResult;
  sim: SimulationState & { run: (cfg?: SimulationConfig) => void; cancel: () => void };
  config: SimulationConfig;
  onConfigChange: (cfg: SimulationConfig) => void;
}

const tooltipStyle = {
  background: '#fffdf7',
  border: '2px solid #111',
  borderRadius: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export function MonteCarloPanel({ result, sim, config, onConfigChange }: MonteCarloPanelProps) {
  const [draft, setDraft] = useState<SimulationConfig>(config);
  const ids = { iter: useId(), score: useId(), weight: useId(), drop: useId(), seed: useId() };
  useEffect(() => setDraft(config), [config]);

  const errors = validateConfig(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(sim.result?.config ?? config);
  const running = sim.status === 'running';
  const alts = result.decision.alternatives;
  const r = sim.result;

  const apply = (cfg: SimulationConfig) => {
    if (validateConfig(cfg).length) return;
    onConfigChange(cfg);
    sim.run(cfg);
  };

  const winData = r ? alts.map((a, i) => ({ name: a.label, freq: r.winFrequency[a.id], moe: r.winFrequencyMoe[a.id], color: altColor(i) })) : [];
  const distData = r
    ? r.histogram.map((b) => {
        const row: Record<string, number | string> = { bin: `${b.binStart}–${b.binEnd}`, mid: b.binStart + 2.5 };
        for (const a of alts) row[a.id] = b.counts[a.id] / r.iterations;
        return row;
      })
    : [];
  const winnerLabel = alts.find((a) => a.id === result.winnerId)!.label;

  return (
    <section id="montecarlo" className="panel section" aria-labelledby="mc-title">
      <div className="sticker">EXHIBIT D</div>
      <h2 id="mc-title" className="section-title">Monte Carlo Department of Alternate Universes</h2>
      <p className="section-sub">
        Re-runs the Council thousands of times with perturbed weights, noisy scores and randomly absent specialists, using a seeded
        Mulberry32 PRNG. It measures how fragile this joke model is, not what will actually happen to you.
      </p>

      <form
        className="mc-controls"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <div className="control">
          <label htmlFor={ids.iter}>Scenarios</label>
          <select id={ids.iter} value={draft.iterations} onChange={(e) => setDraft({ ...draft, iterations: Number(e.target.value) })}>
            {ITERATION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
                {n === DEFAULT_SIM_CONFIG.iterations ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor={ids.score}>
            Score noise σ <output>{draft.scoreNoise} pts</output>
          </label>
          <input id={ids.score} type="range" min={0} max={30} step={1} value={draft.scoreNoise} onChange={(e) => setDraft({ ...draft, scoreNoise: Number(e.target.value) })} />
        </div>
        <div className="control">
          <label htmlFor={ids.weight}>
            Weight noise σ <output>{draft.weightNoise.toFixed(2)}</output>
          </label>
          <input id={ids.weight} type="range" min={0} max={1} step={0.05} value={draft.weightNoise} onChange={(e) => setDraft({ ...draft, weightNoise: Number(e.target.value) })} />
        </div>
        <div className="control">
          <label htmlFor={ids.drop}>
            Specialist absence <output>{Math.round(draft.dropout * 100)}%</output>
          </label>
          <input id={ids.drop} type="range" min={0} max={0.5} step={0.05} value={draft.dropout} onChange={(e) => setDraft({ ...draft, dropout: Number(e.target.value) })} />
        </div>
        <div className="control">
          <label htmlFor={ids.seed}>Seed</label>
          <div className="seed-row">
            <input
              id={ids.seed}
              type="number"
              value={Number.isFinite(draft.seed) ? draft.seed : ''}
              onChange={(e) => setDraft({ ...draft, seed: e.target.value === '' ? NaN : Math.trunc(Number(e.target.value)) })}
            />
            <button type="button" className="btn btn-small" onClick={() => setDraft({ ...draft, seed: Math.floor(Math.random() * 1_000_000) })}>
              🎲 New
            </button>
          </div>
        </div>
        <div className="control control-actions">
          {running ? (
            <button type="button" className="btn btn-warn" onClick={sim.cancel}>
              ■ Cancel
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={errors.length > 0}>
              {dirty ? '▶ Run with new settings' : '↻ Re-run simulation'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" disabled={running} onClick={() => apply(DEFAULT_SIM_CONFIG)}>
            Defaults
          </button>
        </div>
        {errors.length > 0 && (
          <div className="field-error control-wide" role="alert">
            {errors.map((e) => (
              <p key={e}>✖ {e}</p>
            ))}
          </div>
        )}
      </form>

      {running && (
        <div className="mc-status">
          <div
            className="progress"
            role="progressbar"
            aria-label="Simulation progress"
            aria-valuemin={0}
            aria-valuemax={sim.total}
            aria-valuenow={sim.completed}
          >
            <div className="progress-fill" style={{ width: `${sim.total ? (sim.completed / sim.total) * 100 : 0}%` }} />
          </div>
          <p>
            Simulating universe {sim.completed.toLocaleString()} of {sim.total.toLocaleString()}… (running in a background worker; the
            page stays usable)
          </p>
        </div>
      )}
      {sim.status === 'cancelled' && (
        <p className="empty-state">Simulation cancelled. The alternate universes have been left unobserved. Press run to try again.</p>
      )}
      {sim.status === 'error' && (
        <div className="error-state" role="alert">
          <p>✖ The multiverse returned an error: {sim.error}</p>
          <button className="btn btn-small" onClick={() => sim.run(config)}>
            Retry
          </button>
        </div>
      )}
      {sim.status === 'idle' && !r && <p className="empty-state">No simulation has run yet.</p>}

      {r && (
        <div className={running ? 'stale' : ''}>
          <div className="mc-summary">
            <div className="kpi">
              <span>Scenarios</span>
              <strong>{r.iterations.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>{winnerLabel} win frequency</span>
              <strong>{pct(r.winFrequency[result.winnerId])}</strong>
              <small>± {pct(r.winFrequencyMoe[result.winnerId], 2)} sampling error</small>
            </div>
            <div className="kpi">
              <span>Verdict overturned</span>
              <strong>{r.upsets.toLocaleString()}</strong>
              <small>{pct(r.upsets / r.iterations)} of universes</small>
            </div>
            <div className="kpi">
              <span>Mean margin</span>
              <strong>{r.meanMargin.toFixed(2)}</strong>
              <small>points</small>
            </div>
            <div className="kpi">
              <span>Runtime</span>
              <strong>{sim.durationMs !== null ? `${Math.round(sim.durationMs)} ms` : '—'}</strong>
              <small>{sim.engine === 'worker' ? 'web worker' : 'main thread (chunked)'} · seed {r.effectiveSeed}</small>
            </div>
          </div>

          <div className="chart-grid">
            <figure className="chart-card">
              <figcaption>Win frequency across {r.iterations.toLocaleString()} perturbed scenarios</figcaption>
              <div className="chart-box" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={winData} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.ink }} stroke={CHART.axis} interval={0} />
                    <YAxis tickFormatter={(v) => pct(Number(v), 0)} domain={[0, 1]} tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} width={44} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={tooltipStyle}
                      formatter={(v, _n, item) => [`${pct(Number(v))} ± ${pct((item.payload as { moe: number }).moe, 2)}`, 'Win frequency']}
                    />
                    <Bar dataKey="freq" radius={[4, 4, 0, 0]}>
                      {winData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                      <LabelList dataKey="freq" position="top" formatter={(v) => pct(Number(v))} style={{ fontSize: 12, fill: CHART.ink }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>

            <figure className="chart-card">
              <figcaption>Distribution of simulated aggregate scores (share of scenarios per 5-point bin)</figcaption>
              <div className="chart-box" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={distData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="mid" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} />
                    <YAxis tickFormatter={(v) => pct(Number(v), 0)} tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} width={44} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => `Score ${Number(v) - 2.5}–${Number(v) + 2.5}`}
                      formatter={(v, name) => [pct(Number(v)), alts.find((a) => a.id === name)?.label ?? String(name)]}
                    />
                    <Legend formatter={(value) => alts.find((a) => a.id === value)?.label ?? value} wrapperStyle={{ fontSize: 12 }} />
                    {alts.map((a, i) => (
                      <Line key={a.id} type="monotone" dataKey={a.id} stroke={altColor(i)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>

            <figure className="chart-card chart-wide">
              <figcaption>Convergence: running win frequency of {winnerLabel} as scenarios accumulate</figcaption>
              <div className="chart-box" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.convergence} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis
                      dataKey="iteration"
                      type="number"
                      domain={[0, r.iterations]}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                      tick={{ fontSize: 11, fill: CHART.muted }}
                      stroke={CHART.axis}
                    />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => pct(Number(v), 0)} tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} width={44} />
                    <ReferenceLine y={r.winFrequency[result.winnerId]} stroke={CHART.muted} strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => `After ${Number(v).toLocaleString()} scenarios`}
                      formatter={(v) => [pct(Number(v), 2), `${winnerLabel} win frequency`]}
                    />
                    <Line type="monotone" dataKey="frequency" stroke={altColor(alts.findIndex((a) => a.id === result.winnerId))} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <caption>Simulated statistics per alternative</caption>
              <thead>
                <tr>
                  <th scope="col">Alternative</th>
                  <th scope="col">Wins</th>
                  <th scope="col">Win freq. (±95% MC error)</th>
                  <th scope="col">Mean</th>
                  <th scope="col">Std dev</th>
                  <th scope="col">P5</th>
                  <th scope="col">Median</th>
                  <th scope="col">P95</th>
                </tr>
              </thead>
              <tbody>
                {alts.map((a, i) => {
                  const st = r.stats[a.id];
                  return (
                    <tr key={a.id}>
                      <th scope="row">
                        <span className="alt-dot" style={{ background: altColor(i) }} aria-hidden="true" /> {a.label}
                      </th>
                      <td>{r.wins[a.id].toLocaleString()}</td>
                      <td>
                        {pct(r.winFrequency[a.id])} ± {pct(r.winFrequencyMoe[a.id], 2)}
                      </td>
                      <td>{st.mean.toFixed(2)}</td>
                      <td>{st.std.toFixed(2)}</td>
                      <td>{st.p5.toFixed(1)}</td>
                      <td>{st.p50.toFixed(1)}</td>
                      <td>{st.p95.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="assumption-grid">
            <div>
              <h3>Assumptions</h3>
              <ul>
                {r.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Limitations (please read)</h3>
              <ul>
                {r.limitations.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
