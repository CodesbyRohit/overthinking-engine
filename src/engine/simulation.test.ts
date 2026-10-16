import { describe, expect, it } from 'vitest';
import { analyze } from './index';
import {
  DEFAULT_SIM_CONFIG,
  MonteCarloSimulator,
  runSimulation,
  simulationInputFrom,
  validateConfig,
  type SimulationInput,
} from './simulation';
import { mulberry32, SeededRandom } from './rng';

function input(dilemma = 'Should I order samosa or vada pav?', alternatives?: string[]): SimulationInput {
  const r = analyze({ dilemma, alternatives });
  if (!r.ok) throw new Error('bad input');
  return simulationInputFrom(r.result);
}

describe('PRNG', () => {
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('gaussian samples have roughly zero mean and unit variance', () => {
    const rng = new SeededRandom(7);
    let sum = 0;
    let sumSq = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      sum += g;
      sumSq += g * g;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.02);
    expect(Math.abs(sumSq / n - 1)).toBeLessThan(0.03);
  });
});

describe('Monte Carlo simulation', () => {
  it('runs 10,000 scenarios by default', () => {
    expect(DEFAULT_SIM_CONFIG.iterations).toBe(10_000);
    const r = runSimulation(input(), DEFAULT_SIM_CONFIG);
    expect(r.iterations).toBe(10_000);
  });

  it('is reproducible for the same seed', () => {
    const a = runSimulation(input(), DEFAULT_SIM_CONFIG);
    const b = runSimulation(input(), DEFAULT_SIM_CONFIG);
    expect(a).toEqual(b);
  });

  it('changes with a different seed', () => {
    const a = runSimulation(input(), DEFAULT_SIM_CONFIG);
    const b = runSimulation(input(), { ...DEFAULT_SIM_CONFIG, seed: 9999 });
    expect(a.effectiveSeed).not.toBe(b.effectiveSeed);
    expect(a.stats).not.toEqual(b.stats);
  });

  it('wins sum to iterations and frequencies sum to 1', () => {
    const r = runSimulation(input('Dinner?', ['Biryani', 'Dosa', 'Salad', 'Pizza']), DEFAULT_SIM_CONFIG);
    const totalWins = Object.values(r.wins).reduce((s, v) => s + v, 0);
    expect(totalWins).toBe(r.iterations);
    const totalFreq = Object.values(r.winFrequency).reduce((s, v) => s + v, 0);
    expect(totalFreq).toBeCloseTo(1, 10);
    for (const id of Object.keys(r.wins)) {
      const histTotal = r.histogram.reduce((s, b) => s + b.counts[id], 0);
      expect(histTotal).toBe(r.iterations);
    }
  });

  it('with zero noise the baseline winner always wins', () => {
    const inp = input();
    const r = runSimulation(inp, { ...DEFAULT_SIM_CONFIG, iterations: 2000, scoreNoise: 0, weightNoise: 0, dropout: 0 });
    expect(r.winFrequency[inp.baselineWinnerId]).toBe(1);
    expect(r.upsets).toBe(0);
  });

  it('chunked stepping matches a single run exactly', () => {
    const inp = input();
    const sim = new MonteCarloSimulator(inp, DEFAULT_SIM_CONFIG);
    while (!sim.done()) sim.step(777);
    expect(sim.finish()).toEqual(runSimulation(inp, DEFAULT_SIM_CONFIG));
  });

  it('percentiles are ordered and within bounds', () => {
    const r = runSimulation(input(), DEFAULT_SIM_CONFIG);
    for (const st of Object.values(r.stats)) {
      expect(st.p5).toBeLessThanOrEqual(st.p50);
      expect(st.p50).toBeLessThanOrEqual(st.p95);
      expect(st.p5).toBeGreaterThanOrEqual(0);
      expect(st.p95).toBeLessThanOrEqual(100);
    }
  });

  it('records a convergence trace ending at the final frequency', () => {
    const inp = input();
    const r = runSimulation(inp, DEFAULT_SIM_CONFIG);
    const last = r.convergence[r.convergence.length - 1];
    expect(last.iteration).toBe(r.iterations);
    expect(last.frequency).toBeCloseTo(r.winFrequency[inp.baselineWinnerId], 10);
  });

  it('survives 100% dropout-like extremes', () => {
    const r = runSimulation(input(), { ...DEFAULT_SIM_CONFIG, iterations: 500, dropout: 0.99 });
    expect(r.iterations).toBe(500);
  });

  it('rejects invalid configurations', () => {
    expect(validateConfig({ ...DEFAULT_SIM_CONFIG, iterations: 0 })).not.toHaveLength(0);
    expect(validateConfig({ ...DEFAULT_SIM_CONFIG, dropout: 1 })).not.toHaveLength(0);
    expect(validateConfig({ ...DEFAULT_SIM_CONFIG, scoreNoise: -1 })).not.toHaveLength(0);
    expect(() => new MonteCarloSimulator(input(), { ...DEFAULT_SIM_CONFIG, iterations: -5 })).toThrow();
  });
});
