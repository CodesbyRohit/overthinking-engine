import { useEffect, useMemo, useRef, useState } from 'react';
import type { DecisionResult } from '../engine';

interface Step {
  title: string;
  glyph: string;
  log: string[];
}

interface DeliberationProps {
  result: DecisionResult;
  fast: boolean;
  simCompleted: number;
  simTotal: number;
  onDone: () => void;
}

function buildSteps(result: DecisionResult): Step[] {
  const alts = result.decision.alternatives;
  const label = (id: string) => alts.find((a) => a.id === id)?.label ?? id;
  const steps: Step[] = [
    {
      title: 'Normalizing alternatives',
      glyph: '🧾',
      log: [
        `> INTAKE: "${result.decision.dilemma}"`,
        `> ${alts.length} alternatives admitted: ${alts.map((a) => a.label).join(' · ')}`,
        ...result.decision.notes.map((n) => `> NOTE: ${n}`),
      ],
    },
  ];
  for (const agent of result.agents) {
    // The single most dramatic factor this agent found, across all alternatives.
    let alert = '';
    let best = -1;
    agent.scores.forEach((s, a) => {
      for (const f of s.factors) {
        if (f.label === 'Baseline') continue;
        if (Math.abs(f.points) > best) {
          best = Math.abs(f.points);
          alert = `⚠ ${agent.discipline.toUpperCase()}: ${f.label} in "${alts[a].label}" (${f.points >= 0 ? '+' : ''}${f.points})`;
        }
      }
    });
    steps.push({
      title: `Consulting ${agent.name}`,
      glyph: agent.glyph,
      log: [`> ${agent.name} [${agent.discipline}, weight ${agent.weight}] ${agent.summary}`, ...(alert ? [alert] : [])],
    });
  }
  steps.push({
    title: 'Aggregating weighted scores',
    glyph: '∑',
    log: result.standings.map((s) => `> #${s.rank} ${s.label}: ${s.aggregate.toFixed(2)} (${s.votes} votes)`),
  });
  steps.push({
    title: 'Simulating alternate universes',
    glyph: '🎲',
    log: ['> Monte Carlo engine dispatched to a background worker'],
  });
  steps.push({
    title: 'Drafting the official decree',
    glyph: '📜',
    log: [`> Verdict sealed. Winner classified until reveal. (It is ${label(result.winnerId).length} characters long.)`],
  });
  return steps;
}

export function Deliberation({ result, fast, simCompleted, simTotal, onDone }: DeliberationProps) {
  const steps = useMemo(() => buildSteps(result), [result]);
  const [index, setIndex] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const stepMs = fast || reduced ? 160 : 430;

  useEffect(() => {
    if (index >= steps.length) {
      const t = setTimeout(() => doneRef.current(), fast ? 250 : 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIndex((i) => i + 1), stepMs);
    return () => clearTimeout(t);
  }, [index, steps.length, stepMs, fast]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [index]);

  const current = steps[Math.min(index, steps.length - 1)];
  const progress = Math.min(1, index / steps.length);
  const lines = steps.slice(0, index + 1).flatMap((s) => s.log);
  const simPct = simTotal ? Math.round((simCompleted / simTotal) * 100) : 0;

  return (
    <section className="deliberation panel" aria-labelledby="delib-title">
      <div className="sticker sticker-left blink">LIVE · DELIBERATION IN PROGRESS</div>
      <div className="delib-grid">
        <div className="delib-main">
          <div className="delib-glyph" aria-hidden="true" key={index}>
            {current.glyph}
          </div>
          <h2 id="delib-title" className="delib-title" aria-live="polite">
            {index >= steps.length ? 'Deliberation complete' : current.title}
            <span className="dots" aria-hidden="true" />
          </h2>
          <div
            className="progress"
            role="progressbar"
            aria-label="Deliberation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="delib-meta">
            Step {Math.min(index + 1, steps.length)} of {steps.length} · {Math.round(progress * 100)}% · Monte Carlo {simPct}% (
            {simCompleted.toLocaleString()}/{simTotal.toLocaleString()} universes)
          </p>
          <ol className="agent-tokens" aria-label="Specialists consulted">
            {result.agents.map((a, i) => {
              const state = index > i + 1 ? 'done' : index === i + 1 ? 'active' : 'waiting';
              return (
                <li key={a.agentId} className={`token token-${state}`} title={`${a.name} (${a.discipline})`}>
                  <span aria-hidden="true">{a.glyph}</span>
                  <span className="sr-only">
                    {a.name}: {state}
                  </span>
                </li>
              );
            })}
          </ol>
          <button className="btn btn-ghost" onClick={() => doneRef.current()}>
            Skip the theatrics ⏭
          </button>
        </div>
        <div className="terminal" ref={logRef} tabIndex={0} aria-label="Deliberation log">
          {lines.map((line, i) => (
            <div key={i} className={`term-line ${line.startsWith('⚠') ? 'term-alert' : ''}`}>
              {line}
            </div>
          ))}
          <span className="cursor" aria-hidden="true">
            █
          </span>
        </div>
      </div>
    </section>
  );
}
