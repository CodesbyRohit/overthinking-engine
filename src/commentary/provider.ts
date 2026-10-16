import { pickBy } from '../engine/rng';
import type { VerdictReport } from '../engine/verdict';

/**
 * Optional AI commentary.
 *
 * The app never calls an LLM directly and never holds API keys. If you want
 * LLM-generated commentary, deploy your own serverless endpoint that holds the
 * key server-side and set at build time:
 *
 *   VITE_ENABLE_AI_COMMENTARY=true
 *   VITE_AI_COMMENTARY_ENDPOINT=/api/commentary
 *
 * The endpoint receives a CommentaryRequest as JSON and must return { "commentary": string }.
 * When disabled or failing, the app shows deterministic template commentary instead.
 */

export interface CommentaryRequest {
  caseNumber: string;
  dilemma: string;
  winner: string;
  aggregate: number;
  rejected: string[];
  consensusIndex: number;
}

export interface CommentaryProvider {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  generate(verdict: VerdictReport, signal?: AbortSignal): Promise<string>;
}

export function toCommentaryRequest(v: VerdictReport): CommentaryRequest {
  return {
    caseNumber: v.caseNumber,
    dilemma: v.dilemma,
    winner: v.winnerLabel,
    aggregate: v.aggregate,
    rejected: v.rejected.map((r) => r.label),
    consensusIndex: v.confidence.index,
  };
}

/** Default provider: AI commentary is off. */
export const disabledProvider: CommentaryProvider = {
  id: 'disabled',
  label: 'Disabled',
  enabled: false,
  async generate() {
    throw new Error('AI commentary is disabled.');
  },
};

/** Calls a same-origin (or CORS-enabled) endpoint that you control. Holds no secrets. */
export function endpointProvider(endpoint: string): CommentaryProvider {
  return {
    id: 'endpoint',
    label: `Endpoint (${endpoint})`,
    enabled: true,
    async generate(verdict, signal) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCommentaryRequest(verdict)),
        signal,
      });
      if (!res.ok) throw new Error(`Commentary endpoint returned ${res.status}`);
      const data = (await res.json()) as { commentary?: unknown };
      if (typeof data.commentary !== 'string' || data.commentary.trim() === '') throw new Error('Malformed commentary response');
      return data.commentary.slice(0, 2000);
    },
  };
}

export function getCommentaryProvider(): CommentaryProvider {
  const env = import.meta.env;
  const endpoint = env.VITE_AI_COMMENTARY_ENDPOINT as string | undefined;
  if (env.VITE_ENABLE_AI_COMMENTARY === 'true' && endpoint) return endpointProvider(endpoint);
  return disabledProvider;
}

const OPENERS = [
  'Sources close to the Council describe the deliberations as "unnecessary but thorough."',
  'Breaking: twelve specialists have spent more compute on this than NASA spent on Apollo 11 (unverified).',
  'Analysts are calling it the most over-engineered decision of the fiscal quarter.',
  'In a move that surprised nobody with a calculator, the Council has spoken.',
];

/** Deterministic, template-based commentary. Always available, no AI involved. */
export function houseCommentary(v: VerdictReport): string {
  const opener = pickBy(OPENERS, v.caseNumber);
  const runnerUp = v.rejected[0];
  const sim =
    v.simulation.winFrequency !== null
      ? ` In ${(v.simulation.winFrequency * 100).toFixed(1)}% of ${v.simulation.iterations!.toLocaleString()} simulated alternate universes, ${v.winnerLabel} still came out on top.`
      : '';
  const rival = runnerUp
    ? ` ${runnerUp.label} put up a fight at ${runnerUp.aggregate.toFixed(2)} points but will now be remembered only in hypotheticals.`
    : '';
  return `${opener} ${v.winnerLabel} wins with ${v.aggregate.toFixed(2)} points and a consensus index of ${v.confidence.index}/100.${rival}${sim} Risk level: ${v.risk.level}.`;
}
