import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DecisionResult } from '../engine';
import { altColor, CHART } from '../lib/colors';

interface ScoreboardProps {
  result: DecisionResult;
}

const tooltipStyle = {
  background: '#fffdf7',
  border: '2px solid #111',
  borderRadius: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
};

export function Scoreboard({ result }: ScoreboardProps) {
  const alts = result.decision.alternatives;
  const idxOf = (id: string) => alts.findIndex((a) => a.id === id);
  const winnerIdx = idxOf(result.winnerId);
  const runnerUp = result.standings[1];
  const runnerIdx = idxOf(runnerUp.alternativeId);

  const aggData = result.standings.map((s) => ({
    name: s.label,
    aggregate: s.aggregate,
    votes: s.votes,
    color: altColor(idxOf(s.alternativeId)),
  }));

  const diffData = result.agents
    .map((a) => ({
      name: `${a.glyph} ${a.discipline}`,
      diff: Math.round(((a.weight * (a.scores[winnerIdx].score - a.scores[runnerIdx].score)) / result.totalWeight) * 100) / 100,
    }))
    .sort((x, y) => y.diff - x.diff);

  return (
    <section id="scoreboard" className="panel section" aria-labelledby="scoreboard-title">
      <div className="sticker">EXHIBIT B</div>
      <h2 id="scoreboard-title" className="section-title">Scoreboard of Consequence</h2>
      <p className="section-sub">
        Aggregate = Σ(weight × score) ÷ Σ weights (total weight {result.totalWeight.toFixed(2)}). Ties within 0.005 are broken by votes,
        then the Risk directorate, then the Sacred Hash.
      </p>

      <div className="chart-grid">
        <figure className="chart-card">
          <figcaption>Weighted aggregate score (0–100)</figcaption>
          <div className="chart-box" style={{ height: Math.max(160, aggData.length * 52 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barCategoryGap={10}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: CHART.ink }} stroke={CHART.axis} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={tooltipStyle}
                  formatter={(v) => [Number(v).toFixed(2), 'Aggregate']}
                />
                <Bar dataKey="aggregate" radius={[0, 4, 4, 0]} isAnimationActive>
                  {aggData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                  <LabelList dataKey="aggregate" position="right" formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 12, fill: CHART.ink }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <figure className="chart-card">
          <figcaption>
            Who tipped it? Weighted points: {alts[winnerIdx].label} vs {runnerUp.label}
          </figcaption>
          <div className="legend" aria-hidden="true">
            <span>
              <i style={{ background: altColor(winnerIdx) }} /> favours {alts[winnerIdx].label}
            </span>
            <span>
              <i style={{ background: altColor(runnerIdx) }} /> favours {runnerUp.label}
            </span>
          </div>
          <div className="chart-box" style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diffData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={4}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CHART.muted }} stroke={CHART.axis} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: CHART.ink }} stroke={CHART.axis} interval={0} />
                <ReferenceLine x={0} stroke={CHART.ink} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={tooltipStyle}
                  formatter={(v) => {
                    const n = Number(v);
                    return [`${n >= 0 ? '+' : ''}${n.toFixed(2)} pts`, n >= 0 ? `for ${alts[winnerIdx].label}` : `for ${runnerUp.label}`];
                  }}
                />
                <Bar dataKey="diff" radius={4}>
                  {diffData.map((d) => (
                    <Cell key={d.name} fill={d.diff >= 0 ? altColor(winnerIdx) : altColor(runnerIdx)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>

      <div className="why-box">
        <h3>Why {alts[winnerIdx].label} won</h3>
        <ol>
          {result.explanation.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
      </div>

      <details className="table-view">
        <summary>View the full score matrix as a table</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Specialist</th>
                <th scope="col">Weight</th>
                {alts.map((a) => (
                  <th scope="col" key={a.id}>
                    {a.label}
                  </th>
                ))}
                <th scope="col">Vote</th>
              </tr>
            </thead>
            <tbody>
              {result.agents.map((ag) => (
                <tr key={ag.agentId}>
                  <th scope="row">
                    {ag.glyph} {ag.discipline}
                  </th>
                  <td>{ag.weight}</td>
                  {ag.scores.map((s) => (
                    <td key={s.alternativeId} className={s.alternativeId === ag.voteId ? 'cell-vote' : ''}>
                      {s.score.toFixed(1)}
                    </td>
                  ))}
                  <td>{alts.find((a) => a.id === ag.voteId)?.label}</td>
                </tr>
              ))}
              <tr className="row-total">
                <th scope="row">Aggregate</th>
                <td>{result.totalWeight.toFixed(2)}</td>
                {alts.map((a) => (
                  <td key={a.id}>{result.standings.find((s) => s.alternativeId === a.id)!.aggregate.toFixed(2)}</td>
                ))}
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
