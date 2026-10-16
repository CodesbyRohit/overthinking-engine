# The Overthinking Engine

> *"Because making a decision in 3 seconds is for amateurs."*

**🔴 Live:** **[overthinking-engine-beta.vercel.app](https://overthinking-engine-beta.vercel.app/)** ·
**[▶ Run the demo instantly](https://overthinking-engine-beta.vercel.app/?demo)**

An absurdly over-engineered decision engine for the **DevFest Mumbai 2026 Dumb Ideas Challenge**. Type a trivial dilemma
("Should I order samosa or vada pav?") and a Council of twelve specialists, a decision tree with 100+ branches and a
10,000-universe Monte Carlo simulation will deliberate on it before delivering a formal, sealed, and hilariously overconfident verdict.

Everything runs in the browser. **No backend, no API keys, no paid services, no AI.** The twelve "specialists" are
hand-written deterministic scoring functions. They are not LLM agents and the app never claims they are.

**Try the demo:** open [the live app with `?demo`](https://overthinking-engine-beta.vercel.app/?demo) (or
`http://localhost:5173/?demo` locally), or press **▶ Demo mode**.

---

## Features

| Area | What it does |
| --- | --- |
| **Decision intake** | Free-text dilemma with live alternative extraction ("X or Y", "X, Y or Z", "X vs Y", "between X and Y"), shared-verb factoring ("order samosa or vada pav" → *Samosa*, *Vada pav*), six preset crises, up to 6 custom alternatives, validation for empty/short/over-long input, Ctrl+Enter to submit. |
| **Twelve specialists** | Economics, Psychology, Risk, Chaos Theory, Time Optimization, Regret Minimization, Social Consequences, Energy Conservation, Aesthetics, Opportunity Cost, Overanalysis, and Completely Irrelevant Science. Each produces a 0–100 score per alternative, an itemized factor table, an explanation, a vote and a formal objection. |
| **Decision engine** | Weighted aggregation with documented weights, deterministic tie-breaking, leave-one-out pivotality analysis, exact "what would it take to win" flip multipliers, global counterfactuals and a plain-language explanation of why the winner won. |
| **Decision tree** | Accessible (WAI-ARIA tree) and keyboard-navigable. Covers alternatives → 12 criteria → individual scoring factors, leave-one-out robustness checks, counterfactual outcomes for rejected options, Monte Carlo outcomes and global "what if" scenarios. Every node comes from engine output. |
| **Monte Carlo** | 10,000 scenarios by default (50k / 100k / 250k optional) in a Web Worker, seeded Mulberry32 PRNG, adjustable noise/dropout/seed, cancel/re-run/defaults, win-frequency, score-distribution and convergence charts, percentile table, assumptions and limitations. |
| **Verdict** | Formal report: winner, aggregate score, accurately described confidence index, simulated win frequency with sampling error, rejected alternatives, risk assessment, counterfactual reasoning, an absurd official decree, and a clear disclaimer. One-click **Copy verdict**. |
| **Experience** | Animated deliberation with live log and progress (skippable), chaotic "fake institution" visual design, responsive down to 320px, `prefers-reduced-motion` support, skip link, focus styles, live regions, table views for every chart. |

---

## Getting started

Requirements: **Node.js 20+** (developed on Node 24) and npm.

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
npm test           # run the Vitest unit tests once
npm run build      # type-check (tsc -b) and build to dist/
npm run preview    # serve the production build at http://localhost:4173
```

## Deploying to Vercel

The app is a static Vite site, so no server or environment variables are needed. Production deployment:
**https://overthinking-engine-beta.vercel.app/**

**From the dashboard:** push this repo to GitHub, choose *Add New → Project* in Vercel, import the repository and accept
the detected settings (Framework **Vite**, build command `npm run build`, output directory `dist`). `vercel.json` pins these
values.

**From the CLI:**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Any other static host works too: upload the contents of `dist/`.

---

## How the engine works

All decision logic lives in [`src/engine`](src/engine) and has no React or DOM dependencies.

```
dilemma ─► normalize.ts ─► features.ts ─► agents.ts (12 × N scores) ─► engine.ts (aggregate, rank, explain)
                                                                     ├─► simulation.ts (Monte Carlo, seeded)
                                                                     ├─► tree.ts (decision tree)
                                                                     └─► verdict.ts (report + decree)
```

### 1. Normalization (`normalize.ts`)

* Trims and collapses whitespace. Dilemmas must be 3–280 characters; up to 6 alternatives of at most 60 characters each.
* Strips lead-ins ("Should I", "I can't decide between", …) and splits on `or`, commas, `vs`, `versus`, `/` (and `and`
  after "between").
* If the first alternative starts with a common verb that no other alternative starts with, the verb is factored out.
* Duplicates are merged case-insensitively. **Missing alternatives:** one alternative gets *"Do absolutely nothing"* added
  as the counterfactual; none gives *Yes/No*; an open "what/how…" question gives *Go with your gut* / *Ask the group chat*.
  Synthetic alternatives are flagged in the UI.
* A canonical key (dilemma + sorted alternative keys) seeds every deterministic process, so **the order of the
  alternatives never changes the result**.

### 2. Features (`features.ts`)

Each alternative is reduced to letters, words, syllables, vowel ratio, letter diversity, double letters, a cost tier
(0 free … 3 premium) and lexicon tags (`food`, `fried`, `healthy`, `sweet`, `caffeine`, `expensive`, `cheap`, `effort`,
`rest`, `social`, `risky`, `statusQuo`, `tech`, `colorful`, `clothing`, `instant`). The lexicon is in `features.ts`.

### 3. The Council of Twelve (`agents.ts`)

Each specialist computes `score = clamp(base + Σ factor points, 0, 100)` and reports every factor, so the UI shows where
each point came from.

| Specialist | Discipline | Weight | Rule (abridged) |
| --- | --- | --- | --- |
| Dr. Paisa Vasool | Economics | 1.2 | 78 − 18·cost tier − 0.8/letter beyond 6 + 6 multi-word food + 8 cheap |
| Prof. Dopa Mean | Psychology | 1.1 | 42 + 14/comfort signal (≤2) + 40·(vowel ratio − 0.3) − 18 social dread − 6 avoidance |
| Cmdr. Worst Case | Risk | 1.3 | 82 − 22 risky − 10 fried − 6 social − 3/word beyond 2 + 8 status quo + 6 healthy |
| Dr. Butterfly Effect | Chaos Theory | 0.7 | Logistic map x ← 3.99·x(1−x), x₀ from a hash, one iteration per letter; 100·x |
| Chrono-Analyst Tick-Tock | Time Optimization | 1.0 | 92 − 4/syllable (≈180 ms each) − 12 effort + 10 instant + 4 rest |
| Dr. Future You | Regret Minimization | 1.25 | 58 ± 10 action/inaction − 16 risky + 10 healthy + 8 craving − 4 fried |
| Baroness Optics | Social Consequences | 0.9 | 55 + 12 photogenic + local-icon bonus + 6 social + 5 two-word name − 20 screenshot hazard − 8 indecisive |
| Eng. Joule Saver | Energy Conservation | 1.0 | 70 − 18 effort + 14 rest − 0.5/letter + 8 food + 6 caffeine |
| Mme. Kerning | Aesthetics | 0.8 | 60 − 6·\|letters/word − 6.47\| + 6/double letter + 10 colour + 6 clothing + 25 palindrome + 20·(diversity − 0.6) |
| Dr. Forgone Alternative | Opportunity Cost | 1.1 | 50 + 1.5·(v − best forgone v), v = intrinsic value proxy |
| The Infinite Subcommittee | Overanalysis | 0.6 | 30 + 6/word + 2/syllable + 3/tag + 15 if engine-invented |
| Prof. Quasar Tangent | Irrelevant Science | 0.5 | Letters as elements (a=H … z=Fe); molar mass mod 100 |

Total weight: **11.45**. The full rule text is shown on each specialist's card in the app.

### 4. Aggregation, ties and explanation (`engine.ts`)

* **Aggregate** = Σ(weightᵢ × scoreᵢ) ÷ Σ weights, rounded to 2 decimals.
* **Votes:** each specialist votes for its highest-scored alternative. Votes are advisory; the aggregate is binding.
* **Ties** (aggregates within 0.005) are broken by, in order: more votes, a higher Risk score, then the *Sacred Hash*
  (FNV-1a of the canonical key + alternative). The verdict states which rule resolved the tie.
* **Pivotal specialists:** the winner is recomputed with each specialist removed.
* **Flip multipliers:** for each rejected alternative, the exact weight multiplier on a single specialist that would make
  it win, solved in closed form (aggregates are linear-fractional in that weight), or "impossible".
* **Counterfactuals:** equal weights, majority vote only, doubled Risk weight, 10× Irrelevant Science, and "what if you
  chose X anyway".

### 5. Monte Carlo (`simulation.ts`)

Each scenario:

1. multiplies every weight by a mean-preserving log-normal factor `exp(σw·z − σw²/2)` (default σw = 0.35),
2. drops each specialist independently with probability *p* (default 10%; at least one always remains),
3. adds Gaussian noise N(0, σs) to every score (default σs = 12 points), clamped to [0, 100],
4. recomputes every aggregate and records the winner, score distributions and margin.

Randomness comes from **Mulberry32**, seeded with `FNV-1a(canonical key + "#seed:" + seed)`. The same inputs and seed
always produce bit-identical results. The simulation runs in a Web Worker in 5,000-scenario chunks, with a chunked
main-thread fallback. Reported win frequencies include a 95% normal-approximation **Monte Carlo sampling error** only.

**Limitations (also shown in the app):** this measures how sensitive a set of joke heuristics is to arbitrary noise
settings. Nothing is fitted to data or calibrated, and win frequencies are **not** probabilities of real-world outcomes.

### 6. Confidence

The *Internal Consensus Index* is `100 × (0.5 × share of votes for the winner + 0.5 × min(1, margin / 10))`. The app
describes it as agreement inside the model, not the probability that the choice is right.

---

## Optional AI commentary

`src/commentary/provider.ts` defines a `CommentaryProvider` interface. **It is disabled by default** and the app is fully
functional without it. A deterministic template "press commentary" is always shown.

To plug in an LLM later **without exposing secrets**, deploy your own serverless endpoint that holds the API key
server-side, then build with:

```bash
VITE_ENABLE_AI_COMMENTARY=true
VITE_AI_COMMENTARY_ENDPOINT=/api/commentary
```

The endpoint receives `POST` JSON `{ caseNumber, dilemma, winner, aggregate, rejected[], consensusIndex }` and must return
`{ "commentary": "..." }`. Failures fall back to the template commentary. Never put an API key in a `VITE_` variable:
those are embedded in the public bundle.

---

## Project structure

```
src/
  engine/            pure, framework-free decision logic + Vitest tests
    agents.ts        the twelve specialists
    engine.ts        aggregation, ranking, ties, counterfactuals, explanation
    features.ts      feature extraction + lexicon
    normalize.ts     validation and alternative extraction
    rng.ts           FNV-1a hash, Mulberry32, Box-Muller gaussian
    simulation.ts    incremental Monte Carlo simulator
    tree.ts          decision tree builder
    verdict.ts       verdict report, decrees, clipboard text
  workers/           Web Worker running the simulation
  commentary/        optional AI commentary provider interface
  lib/               React hooks and browser helpers
  components/        UI (intake, deliberation, council, charts, tree, report)
```

## Testing

`npm test` runs the Vitest suites in `src/engine/*.test.ts`. They cover normalization and validation (empty, too long,
duplicates, missing alternatives), transparent scoring (factors reproduce scores; aggregates equal the documented weighted
mean), every tie-break rule, flip multipliers, reproducibility (identical inputs, permuted alternative order), the PRNG,
and simulation correctness (seed determinism, chunked = one-shot, zero-noise sanity, histogram totals, percentiles,
config validation).

---

## Disclaimer

This is entertainment. It is not validated decision science, or financial, medical, nutritional or romantic advice.
Please just order the vada pav.
