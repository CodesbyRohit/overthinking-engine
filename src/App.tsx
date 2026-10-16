import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Deliberation } from './components/Deliberation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { EMPTY_FORM, IntakeForm, type FormState } from './components/IntakeForm';
import {
  analyze,
  buildVerdict,
  DEFAULT_SIM_CONFIG,
  DEMO_PRESET,
  formatVerdictText,
  type DecisionResult,
  type SimulationConfig,
  type ValidationIssue,
} from './engine';
import { copyText } from './lib/clipboard';
import { useSimulation } from './lib/useSimulation';

const Results = lazy(() => import('./components/Results'));
// Start fetching the results bundle early so it is ready by the end of the deliberation.
const preloadResults = () => void import('./components/Results');

type Stage = 'intake' | 'deliberating' | 'results';

export default function App() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [stage, setStage] = useState<Stage>('intake');
  const [fast, setFast] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [simConfig, setSimConfig] = useState<SimulationConfig>(DEFAULT_SIM_CONFIG);
  const [copyStatus, setCopyStatus] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const sim = useSimulation(result, simConfig);
  const finishedSim = sim.status === 'done' ? sim.result : null;
  const verdict = useMemo(() => (result ? buildVerdict(result, finishedSim) : null), [result, finishedSim]);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    mainRef.current?.focus({ preventScroll: true });
  };

  const runAnalysis = useCallback((f: FormState, fastMode: boolean) => {
    const res = analyze({ dilemma: f.dilemma, alternatives: f.useCustom ? f.alternatives : undefined });
    if (!res.ok) {
      setIssues(res.issues);
      return;
    }
    setIssues([]);
    preloadResults();
    setFast(fastMode);
    setResult(res.result);
    setRunCount((n) => n + 1);
    setStage('deliberating');
    goTop();
  }, []);

  const startDemo = useCallback(() => {
    const demoForm: FormState = { dilemma: DEMO_PRESET.dilemma, useCustom: false, alternatives: ['', ''] };
    setForm(demoForm);
    runAnalysis(demoForm, true);
  }, [runAnalysis]);

  // ?demo in the URL runs the demo immediately.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('demo')) startDemo();
  }, [startDemo]);

  // Errors describe the last submission; clear them as soon as the petitioner edits.
  const updateForm = (f: FormState) => {
    setForm(f);
    if (issues.length) setIssues([]);
  };

  const editDilemma = () => {
    setResult(null);
    setStage('intake');
    goTop();
  };

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setIssues([]);
    setResult(null);
    setSimConfig(DEFAULT_SIM_CONFIG);
    setCopyStatus('');
    setStage('intake');
    goTop();
  };

  const copyVerdict = async () => {
    if (!verdict) return;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await copyText(formatVerdictText(verdict));
      setCopyStatus(sim.status === 'running' ? 'Copied ✔ (simulation still running, so win frequency is not included yet)' : 'Copied to clipboard ✔');
    } catch {
      setCopyStatus('Copy failed. Your browser refused; select the report text manually.');
    }
    copyTimer.current = setTimeout(() => setCopyStatus(''), 4000);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header onDemo={startDemo} onHome={resetAll} busy={stage === 'deliberating'} />
      <main id="main" ref={mainRef} tabIndex={-1}>
        {stage === 'intake' && <IntakeForm form={form} onChange={updateForm} onSubmit={() => runAnalysis(form, false)} issues={issues} />}

        {stage === 'deliberating' && result && (
          <Deliberation
            key={runCount}
            result={result}
            fast={fast}
            simCompleted={sim.completed}
            simTotal={sim.total}
            onDone={() => {
              setStage('results');
              goTop();
            }}
          />
        )}

        {stage === 'results' && result && verdict && (
          <ErrorBoundary onReset={resetAll}>
            <Suspense
              fallback={
                <p className="empty-state" role="status">
                  Loading the official findings…
                </p>
              }
            >
              <Results
                key={runCount}
                result={result}
                verdict={verdict}
                sim={sim}
                finishedSim={finishedSim}
                simConfig={simConfig}
                onSimConfigChange={setSimConfig}
                copyStatus={copyStatus}
                onCopy={copyVerdict}
                onEdit={editDilemma}
                onReset={resetAll}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
      <footer className="site-footer">
        <p>
          <strong>The Overthinking Engine</strong> · DevFest Mumbai 2026 Dumb Ideas Challenge · All twelve specialists are deterministic
          functions, not AI. Entertainment only; not validated decision science.
        </p>
        <p>No backend. No API keys. No cookies. Your dilemma never leaves this browser tab.</p>
      </footer>
    </div>
  );
}
