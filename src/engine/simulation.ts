import { hashString, SeededRandom } from './rng';
import type { DecisionResult } from './types';

/**
 * Monte Carlo robustness analysis.
 *
 * Each scenario perturbs the Council's documented parameters and re-runs the
 * weighted aggregation:
 *  - every agent weight is multiplied by a mean-preserving log-normal factor exp(σw·z − σw²/2)
 *  - every agent score gets additive Gaussian noise N(0, σs), clamped to [0, 100]
 *  - every agent independently "calls in sick" (weight 0) with probability p
 *
 * The output measures how sensitive this made-up model is to its made-up
 * parameters. It is NOT a calibrated real-world probability.
 */

export interface SimulationConfig {
  iterations: number;
  seed: number;
  /** Standard deviation (score points) of additive noise on each agent score. */
  scoreNoise: number;
  /** Log-normal sigma for multiplicative noise on weights. */
  weightNoise: number;
  /** Probability that each agent is excluded from a scenario. */
  dropout: number;
}

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  iterations: 10_000,
  seed: 2026,
  scoreNoise: 12,
  weightNoise: 0.35,
  dropout: 0.1,
};

export const ITERATION_OPTIONS = [10_000, 50_000, 100_000, 250_000] as const;

export interface SimulationInput {
  altIds: string[];
  altLabels: string[];
  weights: number[];
  /** [agent][alternative] */
  scores: number[][];
  baselineWinnerId: string;
  canonicalKey: string;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  /** count per alternative id */
  counts: Record<string, number>;
}

export interface AltStats {
  mean: number;
  std: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  /** Effective 32-bit seed actually fed to the PRNG. */
  effectiveSeed: number;
  iterations: number;
  wins: Record<string, number>;
  winFrequency: Record<string, number>;
  /** 95% normal-approximation half-width on each win frequency (sampling error only). */
  winFrequencyMoe: Record<string, number>;
  histogram: HistogramBin[];
  stats: Record<string, AltStats>;
  /** Scenarios in which the baseline winner did not win. */
  upsets: number;
  /** Scenarios where the top two simulated aggregates were exactly equal. */
  exactTies: number;
  /** Running win frequency of the baseline winner, for a convergence chart. */
  convergence: { iteration: number; frequency: number }[];
  meanMargin: number;
  assumptions: string[];
  limitations: string[];
}

const FINE_BINS = 100; // 1-point bins used for percentiles
const CHART_BIN = 5; // 5-point bins used for the distribution chart
const CONVERGENCE_POINTS = 50;

export function simulationInputFrom(result: DecisionResult): SimulationInput {
  return {
    altIds: result.decision.alternatives.map((a) => a.id),
    altLabels: result.decision.alternatives.map((a) => a.label),
    weights: result.agents.map((a) => a.weight),
    scores: result.agents.map((a) => a.scores.map((s) => s.score)),
    baselineWinnerId: result.winnerId,
    canonicalKey: result.decision.canonicalKey,
  };
}

export function effectiveSeed(input: SimulationInput, config: SimulationConfig): number {
  return hashString(`${input.canonicalKey}#seed:${config.seed}`);
}

export function validateConfig(config: SimulationConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(config.iterations) || config.iterations < 1 || config.iterations > 1_000_000) {
    errors.push('Iterations must be an integer between 1 and 1,000,000.');
  }
  if (!Number.isFinite(config.seed)) errors.push('Seed must be a number.');
  if (!(config.scoreNoise >= 0 && config.scoreNoise <= 50)) errors.push('Score noise must be between 0 and 50.');
  if (!(config.weightNoise >= 0 && config.weightNoise <= 2)) errors.push('Weight noise must be between 0 and 2.');
  if (!(config.dropout >= 0 && config.dropout < 1)) errors.push('Dropout must be in [0, 1).');
  return errors;
}

/**
 * Incremental simulator. Call step() repeatedly (e.g. from a worker or in
 * animation-frame-sized chunks) and finish() once done() is true.
 */
export class MonteCarloSimulator {
  readonly total: number;
  completed = 0;
  private readonly rng: SeededRandom;
  private readonly nAgents: number;
  private readonly nAlts: number;
  private readonly wins: number[];
  private readonly fine: number[][];
  private readonly sum: number[];
  private readonly sumSq: number[];
  private readonly scenarioWeights: number[];
  private readonly scenarioAgg: number[];
  private readonly baselineIdx: number;
  private upsets = 0;
  private exactTies = 0;
  private marginSum = 0;
  private readonly convergence: { iteration: number; frequency: number }[] = [];
  private readonly convergenceEvery: number;
  readonly seed: number;

  constructor(
    private readonly input: SimulationInput,
    private readonly config: SimulationConfig,
  ) {
    const errors = validateConfig(config);
    if (errors.length) throw new Error(errors.join(' '));
    if (input.altIds.length < 2) throw new Error('Simulation requires at least two alternatives.');
    this.total = config.iterations;
    this.seed = effectiveSeed(input, config);
    this.rng = new SeededRandom(this.seed);
    this.nAgents = input.weights.length;
    this.nAlts = input.altIds.length;
    this.wins = new Array(this.nAlts).fill(0);
    this.fine = Array.from({ length: this.nAlts }, () => new Array(FINE_BINS).fill(0));
    this.sum = new Array(this.nAlts).fill(0);
    this.sumSq = new Array(this.nAlts).fill(0);
    this.scenarioWeights = new Array(this.nAgents).fill(0);
    this.scenarioAgg = new Array(this.nAlts).fill(0);
    this.baselineIdx = input.altIds.indexOf(input.baselineWinnerId);
    this.convergenceEvery = Math.max(1, Math.floor(this.total / CONVERGENCE_POINTS));
  }

  done(): boolean {
    return this.completed >= this.total;
  }

  /** Run up to `count` more scenarios. Returns the number actually run. */
  step(count: number): number {
    const { rng, nAgents, nAlts, input, config, scenarioWeights: w, scenarioAgg: agg } = this;
    const n = Math.min(count, this.total - this.completed);
    const sigmaW = config.weightNoise;
    const drift = (sigmaW * sigmaW) / 2;

    for (let it = 0; it < n; it++) {
      // 1. Perturb weights and apply dropout.
      let wTotal = 0;
      for (let i = 0; i < nAgents; i++) {
        const dropped = rng.next() < config.dropout;
        const factor = Math.exp(sigmaW * rng.gaussian() - drift);
        w[i] = dropped ? 0 : input.weights[i] * factor;
        wTotal += w[i];
      }
      if (wTotal === 0) {
        // Everybody called in sick: reinstate one agent at random.
        const i = rng.int(nAgents);
        w[i] = input.weights[i];
        wTotal = w[i];
      }

      // 2. Perturb scores and aggregate.
      for (let a = 0; a < nAlts; a++) agg[a] = 0;
      for (let i = 0; i < nAgents; i++) {
        const row = input.scores[i];
        for (let a = 0; a < nAlts; a++) {
          const noisy = row[a] + config.scoreNoise * rng.gaussian();
          const s = noisy < 0 ? 0 : noisy > 100 ? 100 : noisy;
          agg[a] += w[i] * s;
        }
      }

      // 3. Determine the scenario winner.
      let best = 0;
      let second = -1;
      for (let a = 0; a < nAlts; a++) {
        agg[a] /= wTotal;
        if (a === 0) continue;
        if (agg[a] > agg[best]) {
          second = best;
          best = a;
        } else if (second === -1 || agg[a] > agg[second]) {
          second = a;
        }
      }
      if (second === -1) second = best === 0 ? 1 : 0;
      if (agg[best] === agg[second]) {
        this.exactTies++;
        if (rng.next() < 0.5) best = second;
      }
      this.wins[best]++;
      if (best !== this.baselineIdx) this.upsets++;
      this.marginSum += Math.abs(agg[best] - agg[second]);

      // 4. Record distributions.
      for (let a = 0; a < nAlts; a++) {
        const v = agg[a];
        this.sum[a] += v;
        this.sumSq[a] += v * v;
        const bin = Math.min(FINE_BINS - 1, Math.floor(v));
        this.fine[a][bin]++;
      }

      this.completed++;
      if (this.completed % this.convergenceEvery === 0 || this.completed === this.total) {
        this.convergence.push({
          iteration: this.completed,
          frequency: this.baselineIdx >= 0 ? this.wins[this.baselineIdx] / this.completed : 0,
        });
      }
    }
    return n;
  }

  finish(): SimulationResult {
    const { input, config, nAlts } = this;
    const N = this.completed || 1;
    const wins: Record<string, number> = {};
    const winFrequency: Record<string, number> = {};
    const winFrequencyMoe: Record<string, number> = {};
    const stats: Record<string, AltStats> = {};

    for (let a = 0; a < nAlts; a++) {
      const id = input.altIds[a];
      const p = this.wins[a] / N;
      wins[id] = this.wins[a];
      winFrequency[id] = p;
      winFrequencyMoe[id] = 1.96 * Math.sqrt((p * (1 - p)) / N);
      const mean = this.sum[a] / N;
      const variance = Math.max(0, this.sumSq[a] / N - mean * mean);
      stats[id] = {
        mean,
        std: Math.sqrt(variance),
        p5: percentile(this.fine[a], N, 0.05),
        p50: percentile(this.fine[a], N, 0.5),
        p95: percentile(this.fine[a], N, 0.95),
      };
    }

    const histogram: HistogramBin[] = [];
    for (let start = 0; start < 100; start += CHART_BIN) {
      const counts: Record<string, number> = {};
      for (let a = 0; a < nAlts; a++) {
        let c = 0;
        for (let b = start; b < start + CHART_BIN; b++) c += this.fine[a][b];
        counts[input.altIds[a]] = c;
      }
      histogram.push({ binStart: start, binEnd: start + CHART_BIN, counts });
    }

    return {
      config,
      effectiveSeed: this.seed,
      iterations: this.completed,
      wins,
      winFrequency,
      winFrequencyMoe,
      histogram,
      stats,
      upsets: this.upsets,
      exactTies: this.exactTies,
      convergence: this.convergence.slice(),
      meanMargin: this.marginSum / N,
      assumptions: [
        `Agent scores receive independent Gaussian noise with σ = ${config.scoreNoise} points, clamped to [0, 100].`,
        `Agent weights are multiplied by a mean-preserving log-normal factor with σ = ${config.weightNoise}.`,
        `Each agent is independently excluded from a scenario with probability ${(config.dropout * 100).toFixed(0)}%.`,
        'Perturbations are independent across agents, alternatives and scenarios (no correlations are modelled).',
        `PRNG: Mulberry32 seeded with ${this.seed} (derived from the dilemma and seed ${config.seed}). Same inputs → same results.`,
      ],
      limitations: [
        'The model being perturbed is a set of joke heuristics. Robustness of a joke is still a joke.',
        'Win frequencies describe sensitivity to the chosen noise settings, not the probability that you will be happy.',
        'Noise distributions were chosen for vibes, not fitted to any data. Nothing here is calibrated.',
        'Margin of error shown covers Monte Carlo sampling error only, not the model being wrong (it is).',
      ],
    };
  }
}

function percentile(bins: number[], total: number, q: number): number {
  const target = q * total;
  let cumulative = 0;
  for (let b = 0; b < bins.length; b++) {
    const next = cumulative + bins[b];
    if (next >= target && bins[b] > 0) {
      // Linear interpolation within the 1-point bin.
      return b + (target - cumulative) / bins[b];
    }
    cumulative = next;
  }
  return bins.length;
}

/** Run a whole simulation synchronously. Used by tests and the main-thread fallback. */
export function runSimulation(input: SimulationInput, config: SimulationConfig): SimulationResult {
  const sim = new MonteCarloSimulator(input, config);
  sim.step(config.iterations);
  return sim.finish();
}
