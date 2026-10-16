const ALERTS = [
  '⚠ SYSTEM ALERT: Decision latency below 3 seconds detected in sector 7. Dispatching committee.',
  '◉ 12 specialists online · 0 of them qualified',
  '⚠ WARNING: Samosa triangularity exceeds regulatory tolerance',
  '✶ Monte Carlo engine warmed up to 10,000 alternate universes',
  '◉ Overthinking capacity: 4,700% of recommended daily allowance',
  '⚠ NOTICE: Browser tab count has achieved sentience',
  '✶ Peer review pending since 2019',
  '◉ Confidence intervals available upon request (they are wide)',
];

interface HeaderProps {
  onDemo: () => void;
  onHome: () => void;
  busy: boolean;
}

export function Header({ onDemo, onHome, busy }: HeaderProps) {
  const ticker = ALERTS.join('   ///   ');
  return (
    <header className="site-header">
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          <span>{ticker}</span>
          <span>{ticker}</span>
        </div>
      </div>
      <div className="header-main">
        <button className="logo" onClick={onHome} aria-label="The Overthinking Engine: go to the start">
          <span className="logo-the">THE</span>
          <span className="logo-word">OVERTHINKING</span>
          <span className="logo-word logo-word-2">ENGINE</span>
        </button>
        <div className="header-side">
          <p className="tagline">“Because making a decision in 3 seconds is for amateurs.”</p>
          <div className="header-badges">
            <span className="badge badge-tilt">v47.3.1-final-FINAL</span>
            <span className="badge">Accredited by nobody</span>
            <span className="badge badge-hot">DevFest Mumbai 2026</span>
          </div>
          <button className="btn btn-demo" onClick={onDemo} disabled={busy}>
            ▶ Demo mode
          </button>
        </div>
      </div>
    </header>
  );
}
