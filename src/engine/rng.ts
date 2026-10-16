/**
 * Deterministic randomness utilities.
 *
 * Everything "random" in the Overthinking Engine flows through these functions so
 * that identical inputs always yield identical outputs.
 */

/** 32-bit FNV-1a hash of a string. Stable across platforms and runs. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Hash a string into a float in [0, 1). */
export function hash01(input: string): number {
  // Run the hash through one round of mulberry32 to spread low-entropy inputs.
  return mulberry32(hashString(input))();
}

/**
 * Mulberry32: a small, fast, seeded 32-bit PRNG with a full 2^32 period.
 * Returns floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded RNG with a few convenience distributions. */
export class SeededRandom {
  private readonly nextFloat: () => number;
  private spareGaussian: number | null = null;

  constructor(seed: number) {
    this.nextFloat = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextFloat();
  }

  /** Standard normal sample via the Box-Muller transform (caches the spare value). */
  gaussian(): number {
    if (this.spareGaussian !== null) {
      const spare = this.spareGaussian;
      this.spareGaussian = null;
      return spare;
    }
    let u = 0;
    // Avoid log(0).
    while (u === 0) u = this.nextFloat();
    const v = this.nextFloat();
    const mag = Math.sqrt(-2 * Math.log(u));
    this.spareGaussian = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.nextFloat() * maxExclusive);
  }
}

/** Deterministically pick an element of a non-empty array using a string key. */
export function pickBy<T>(items: readonly T[], key: string): T {
  return items[hashString(key) % items.length];
}
