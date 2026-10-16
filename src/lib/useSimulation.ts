import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MonteCarloSimulator,
  simulationInputFrom,
  type DecisionResult,
  type SimulationConfig,
  type SimulationResult,
} from '../engine';
import type { WorkerRequest, WorkerResponse } from '../workers/simulation.worker';

export type SimStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface SimulationState {
  status: SimStatus;
  completed: number;
  total: number;
  result: SimulationResult | null;
  error: string | null;
  /** 'worker' when computed off the main thread, 'main' for the chunked fallback. */
  engine: 'worker' | 'main' | null;
  durationMs: number | null;
}

const INITIAL: SimulationState = { status: 'idle', completed: 0, total: 0, result: null, error: null, engine: null, durationMs: null };

/**
 * Runs the Monte Carlo simulation in a Web Worker so the UI stays responsive.
 * Falls back to main-thread chunks (yielding between chunks) if workers are unavailable.
 */
export function useSimulation(result: DecisionResult | null, config: SimulationConfig) {
  const [state, setState] = useState<SimulationState>(INITIAL);
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const startRef = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const stopAll = useCallback(() => {
    runIdRef.current++;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const runOnMainThread = useCallback((runId: number, decision: DecisionResult, cfg: SimulationConfig) => {
    let sim: MonteCarloSimulator;
    try {
      sim = new MonteCarloSimulator(simulationInputFrom(decision), cfg);
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err instanceof Error ? err.message : String(err) }));
      return;
    }
    const tick = () => {
      if (runId !== runIdRef.current) return;
      sim.step(2_000);
      if (sim.done()) {
        setState({
          status: 'done',
          completed: sim.completed,
          total: sim.total,
          result: sim.finish(),
          error: null,
          engine: 'main',
          durationMs: performance.now() - startRef.current,
        });
      } else {
        setState((s) => ({ ...s, completed: sim.completed, total: sim.total }));
        fallbackTimer.current = setTimeout(tick, 0);
      }
    };
    fallbackTimer.current = setTimeout(tick, 0);
  }, []);

  const run = useCallback(
    (cfg: SimulationConfig = config) => {
      if (!result) return;
      stopAll();
      const runId = runIdRef.current;
      startRef.current = performance.now();
      // Keep the previous result visible (marked stale) while re-running the same decision.
      const sameDecision = lastKeyRef.current === result.decision.canonicalKey;
      lastKeyRef.current = result.decision.canonicalKey;
      setState((s) => ({ ...INITIAL, status: 'running', total: cfg.iterations, result: sameDecision ? s.result : null }));

      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        worker = null;
      }
      if (!worker) {
        setState((s) => ({ ...s, engine: 'main' }));
        runOnMainThread(runId, result, cfg);
        return;
      }
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.runId !== runIdRef.current) return;
        if (msg.type === 'progress') {
          setState((s) => ({ ...s, completed: msg.completed, total: msg.total, engine: 'worker' }));
        } else if (msg.type === 'done') {
          setState({
            status: 'done',
            completed: msg.result.iterations,
            total: msg.result.iterations,
            result: msg.result,
            error: null,
            engine: 'worker',
            durationMs: performance.now() - startRef.current,
          });
          worker!.terminate();
          workerRef.current = null;
        } else {
          setState((s) => ({ ...s, status: 'error', error: msg.message }));
        }
      };
      worker.onerror = () => {
        // Worker failed to load (e.g. strict CSP): fall back to the main thread.
        if (runId !== runIdRef.current) return;
        worker!.terminate();
        workerRef.current = null;
        runOnMainThread(runId, result, cfg);
      };
      const request: WorkerRequest = { runId, input: simulationInputFrom(result), config: cfg };
      worker.postMessage(request);
    },
    [config, result, runOnMainThread, stopAll],
  );

  const cancel = useCallback(() => {
    stopAll();
    setState((s) => (s.status === 'running' ? { ...s, status: 'cancelled' } : s));
  }, [stopAll]);

  // Automatically run whenever a new decision arrives.
  useEffect(() => {
    lastKeyRef.current = null;
    if (result) run(config);
    else {
      stopAll();
      setState(INITIAL);
    }
    // Only re-run automatically when the decision itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => stopAll, [stopAll]);

  return { ...state, run, cancel };
}
