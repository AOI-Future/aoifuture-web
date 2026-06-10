// Structured randomness utilities for generative visuals.
// Seeded PRNG + low-discrepancy sequences + smooth value noise
// — "computed" randomness instead of raw Math.random().

/** Mulberry32: fast seeded PRNG, returns a function yielding [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// R2 sequence constants (generalized golden ratio, Roberts 2018).
// Successive points are maximally spread over the unit square —
// blob placement covers the field evenly instead of clumping.
const G = 1.32471795724474602596; // plastic number
const A1 = 1 / G;
const A2 = 1 / (G * G);

/** n-th point of the R2 low-discrepancy sequence, offset by a seed phase. */
export function r2Point(n: number, phaseX = 0.5, phaseY = 0.5): [number, number] {
  return [(phaseX + A1 * n) % 1, (phaseY + A2 * n) % 1];
}

/**
 * Smooth 1D value noise: seeded lattice values blended with a smoothstep.
 * Returns values in [-1, 1]; continuous in t, so motion driven by it
 * drifts organically instead of jumping.
 */
export class ValueNoise1D {
  private values: Float32Array;
  private size: number;

  constructor(seed: number, size = 256) {
    this.size = size;
    this.values = new Float32Array(size);
    const rand = mulberry32(seed);
    for (let i = 0; i < size; i++) this.values[i] = rand() * 2 - 1;
  }

  at(t: number): number {
    const i0 = Math.floor(t);
    const f = t - i0;
    const a = this.values[((i0 % this.size) + this.size) % this.size];
    const b = this.values[(((i0 + 1) % this.size) + this.size) % this.size];
    const u = f * f * (3 - 2 * f); // smoothstep
    return a + (b - a) * u;
  }

  /** Fractal (2-octave) variant for slightly richer motion. */
  fbm(t: number): number {
    return this.at(t) * 0.7 + this.at(t * 2.7 + 31.4) * 0.3;
  }
}
