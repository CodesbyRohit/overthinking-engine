import { MonteCarloSimulator, type SimulationConfig, type SimulationInput } from '../engine/simulation';

export interface WorkerRequest {
  runId: number;
  input: SimulationInput;
  config: SimulationConfig;
}

export type WorkerResponse =
  | { runId: number; type: 'progress'; completed: number; total: number }
  | { runId: number; type: 'done'; result: ReturnType<MonteCarloSimulator['finish']> }
  | { runId: number; type: 'error'; message: string };

// Typed minimally to avoid pulling the WebWorker lib (which conflicts with DOM) into the build.
const ctx = self as unknown as {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};
const CHUNK = 5_000;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { runId, input, config } = event.data;
  try {
    const sim = new MonteCarloSimulator(input, config);
    while (!sim.done()) {
      sim.step(CHUNK);
      ctx.postMessage({ runId, type: 'progress', completed: sim.completed, total: sim.total } satisfies WorkerResponse);
    }
    ctx.postMessage({ runId, type: 'done', result: sim.finish() } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({ runId, type: 'error', message: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse);
  }
};
