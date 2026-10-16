import { useState } from 'react';
import type { AgentReport, DecisionResult } from '../engine';
import { altColor } from '../lib/colors';

interface AgentCouncilProps {
  result: DecisionResult;
}

export function AgentCouncil({ result }: AgentCouncilProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'agree' | 'dissent' | 'pivotal'>('all');

  const agents = result.agents.filter((a) =>
    filter === 'all'
      ? true
      : filter === 'agree'
        ? a.agreesWithVerdict
        : filter === 'dissent'
          ? !a.agreesWithVerdict
          : result.pivotalAgentIds.includes(a.agentId),
  );

  const counts = {
    all: result.agents.length,
    agree: result.agents.filter((a) => a.agreesWithVerdict).length,
    dissent: result.agents.filter((a) => !a.agreesWithVerdict).length,
    pivotal: result.pivotalAgentIds.length,
  };

  return (
    <section id="council" className="panel section" aria-labelledby="council-title">
      <div className="sticker">EXHIBIT A</div>
      <h2 id="council-title" className="section-title">The Council of Twelve</h2>
      <p className="section-sub">
        Twelve deterministic scoring functions with different priorities. Not AI. Not sentient. Extremely confident. Open any card to
        see exactly where every point came from.
      </p>
      <div className="filter-row" role="group" aria-label="Filter specialists">
        {(['all', 'agree', 'dissent', 'pivotal'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'chip-active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'agree' ? 'Voted for winner' : f === 'dissent' ? 'Dissenters' : 'Pivotal'} ({counts[f]})
          </button>
        ))}
      </div>
      {agents.length === 0 ? (
        <p className="empty-state">
          {filter === 'pivotal'
            ? 'No pivotal specialists: removing any single one would not change the verdict.'
            : 'Nobody here. The Council is unanimous on this point.'}
        </p>
      ) : (
        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              result={result}
              expanded={open === agent.agentId}
              onToggle={() => setOpen(open === agent.agentId ? null : agent.agentId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AgentCard({
  agent,
  result,
  expanded,
  onToggle,
}: {
  agent: AgentReport;
  result: DecisionResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const alts = result.decision.alternatives;
  const voteIdx = alts.findIndex((a) => a.id === agent.voteId);
  const detailId = `agent-detail-${agent.agentId}`;
  const pivotal = result.pivotalAgentIds.includes(agent.agentId);

  return (
    <article className={`agent-card ${expanded ? 'expanded' : ''} ${agent.agreesWithVerdict ? 'agrees' : 'dissents'}`}>
      <header className="agent-head">
        <span className="agent-glyph" aria-hidden="true">
          {agent.glyph}
        </span>
        <div>
          <h3 className="agent-name">{agent.name}</h3>
          <p className="agent-title">{agent.title}</p>
        </div>
      </header>
      <div className="agent-tags">
        <span className="tag">{agent.discipline}</span>
        <span className="tag">weight {agent.weight} · {(agent.weightShare * 100).toFixed(1)}%</span>
        {pivotal && <span className="tag tag-hot">PIVOTAL</span>}
      </div>
      <ul className="score-bars" aria-label={`${agent.name} scores`}>
        {agent.scores.map((s, a) => (
          <li key={s.alternativeId}>
            <span className="bar-label">{alts[a].label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${s.score}%`, background: altColor(a) }} />
            </span>
            <span className="bar-value">{s.score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="agent-vote">
        <span className="vote-chip" style={{ ['--alt' as string]: altColor(voteIdx) }}>
          VOTE: {alts[voteIdx].label}
        </span>
        <span className={`verdict-flag ${agent.agreesWithVerdict ? 'ok' : 'no'}`}>
          {agent.agreesWithVerdict ? '✔ with majority verdict' : '✖ dissent'}
        </span>
      </p>
      <button className="btn btn-small btn-block" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}>
        {expanded ? '▲ Close dossier' : '▼ Inspect dossier'}
      </button>
      {expanded && (
        <div id={detailId} className="agent-detail">
          <p>
            <strong>Priority:</strong> {agent.priority}
          </p>
          <p className="rule">
            <strong>Scoring rule:</strong> <code>{agent.rule}</code>
          </p>
          {agent.scores.map((s, a) => (
            <div key={s.alternativeId} className="factor-block">
              <h4 style={{ borderColor: altColor(a) }}>
                {alts[a].label}: {s.score.toFixed(1)} → {s.contribution.toFixed(2)} pts in aggregate
              </h4>
              <table className="factor-table">
                <caption className="sr-only">Factors for {alts[a].label}</caption>
                <thead>
                  <tr>
                    <th scope="col">Factor</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {s.factors.map((f) => (
                    <tr key={f.label}>
                      <td>{f.label}</td>
                      <td>{f.value}</td>
                      <td className={f.points >= 0 ? 'pos' : 'neg'}>
                        {f.points >= 0 ? '+' : ''}
                        {f.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="explain">{s.explanation}</p>
            </div>
          ))}
          <p className="objection">
            <strong>Formal objection:</strong> {agent.objection.text}
          </p>
        </div>
      )}
    </article>
  );
}
