/**
 * One-dimensional numerical integration by tanh-sinh (double-exponential)
 * quadrature.
 *
 * Why tanh-sinh: it converges extremely fast for smooth integrands, and --
 * unlike Gauss or Riemann rules -- it also handles endpoint singularities
 * (1/√x, the √(1−x²) edge of a disk, ...) gracefully, because its nodes
 * cluster double-exponentially toward the ends and never land exactly on
 * them. Infinite intervals are mapped onto finite ones by a substitution,
 * which just turns "decays at infinity" into another endpoint behaviour.
 *
 * Levels refine by halving the step h and reusing every previous node, so
 * the difference between successive levels is a free error estimate.
 */

/** t-range covered. Past ~3.5 the weights are below 1e-20 and nodes sit within 1e-23 of the endpoints. */
const T_MAX = 3.5;
const MAX_LEVEL = 9;

interface LevelNodes {
  /** 1 − x for each node, computed directly (not by subtraction) to keep precision near the endpoints. */
  comp: Float64Array;
  weight: Float64Array;
  /** True for nodes in the extreme tail (used for divergence detection). */
  tail: Uint8Array;
}

const CENTER_WEIGHT = Math.PI / 2;
const TAIL_START = T_MAX - 0.25;

function buildLevel(k: number): LevelNodes {
  const h = Math.pow(2, -k);
  const ts: number[] = [];
  if (k === 0) {
    for (let t = 1; t <= T_MAX + 1e-12; t += 1) ts.push(t);
  } else {
    for (let j = 1; j * h <= T_MAX + 1e-12; j += 2) ts.push(j * h);
  }
  const comp = new Float64Array(ts.length);
  const weight = new Float64Array(ts.length);
  const tail = new Uint8Array(ts.length);
  ts.forEach((t, idx) => {
    const u = (Math.PI / 2) * Math.sinh(t);
    const coshU = Math.cosh(u);
    comp[idx] = Math.exp(-u) / coshU; // 1 - tanh(u)
    weight[idx] = ((Math.PI / 2) * Math.cosh(t)) / (coshU * coshU);
    tail[idx] = t >= TAIL_START ? 1 : 0;
  });
  return { comp, weight, tail };
}

const LEVELS: LevelNodes[] = Array.from({ length: MAX_LEVEL + 1 }, (_, k) => buildLevel(k));

export interface QuadratureOptions {
  /** Relative tolerance on the result. */
  tol: number;
  minLevel: number;
  maxLevel: number;
}

export interface QuadratureResult {
  value: number;
  /** Estimated absolute error. */
  error: number;
  converged: boolean;
  /**
   * Largest single contribution from the extreme-tail nodes, relative to
   * the integral of |f|. For a convergent integral this is ~0; when it's
   * not, the integrand isn't decaying fast enough at an endpoint (or at
   * infinity) -- i.e. the integral diverges.
   */
  tailRatio: number;
}

/** Thrown when f is undefined/infinite at a point that isn't right at an endpoint. */
export class NonFiniteValueError extends Error {
  readonly value: number;
  readonly at: number;
  constructor(value: number, at: number) {
    super("Non-finite integrand value");
    this.value = value;
    this.at = at;
  }
}

/** Integrates g over (-1, 1) given as nodes around the center; g receives (offset from left end, offset from right end). */
function tanhSinhUnit(
  evalPair: (comp: number) => [number, number],
  evalCenter: () => number,
  opts: QuadratureOptions,
): QuadratureResult {
  let sum = CENTER_WEIGHT * evalCenter();
  let absSum = Math.abs(sum);
  let maxTail = 0;
  let prev = NaN;
  let estimate = NaN;
  let error = Infinity;
  const maxLevel = Math.min(opts.maxLevel, MAX_LEVEL);

  for (let k = 0; k <= maxLevel; k++) {
    const { comp, weight, tail } = LEVELS[k];
    let levelTail = 0;
    for (let j = 0; j < comp.length; j++) {
      const [fl, fr] = evalPair(comp[j]);
      const w = weight[j];
      sum += w * (fl + fr);
      absSum += w * (Math.abs(fl) + Math.abs(fr));
      if (tail[j]) levelTail = Math.max(levelTail, w * Math.max(Math.abs(fl), Math.abs(fr)));
    }
    const h = Math.pow(2, -k);
    estimate = sum * h;
    maxTail = Math.max(maxTail, levelTail);
    if (k > 0) {
      error = Math.abs(estimate - prev);
      const scale = absSum * h;
      if (k >= opts.minLevel && error <= opts.tol * Math.max(Math.abs(estimate), 1e-3 * scale)) {
        return { value: estimate, error, converged: true, tailRatio: scale > 0 ? maxTail / scale : 0 };
      }
    }
    prev = estimate;
  }
  const scale = absSum * Math.pow(2, -maxLevel);
  return { value: estimate, error, converged: false, tailRatio: scale > 0 ? maxTail / scale : 0 };
}

/** Values at nodes this close (relative) to an endpoint are allowed to be non-finite; they're dropped. */
const ENDPOINT_SLACK = 1e-9;

function guard(value: number, comp: number, at: number): number {
  if (Number.isFinite(value)) return value;
  if (comp < ENDPOINT_SLACK) return 0;
  throw new NonFiniteValueError(value, at);
}

/**
 * ∫_a^b f(x) dx. Either bound may be ±Infinity; b < a gives the signed
 * (negated) result, exactly as the notation means.
 */
export function integrate(f: (x: number) => number, a: number, b: number, opts: QuadratureOptions): QuadratureResult {
  if (Number.isNaN(a) || Number.isNaN(b)) throw new Error("integrate: NaN bound");
  if (a === b) return { value: 0, error: 0, converged: true, tailRatio: 0 };
  if (a > b) {
    const r = integrate(f, b, a, opts);
    return { ...r, value: -r.value };
  }

  const aFinite = Number.isFinite(a);
  const bFinite = Number.isFinite(b);

  if (aFinite && bFinite) {
    const half = (b - a) / 2;
    const mid = (a + b) / 2;
    const r = tanhSinhUnit(
      (c) => {
        const xl = a + half * c;
        const xr = b - half * c;
        return [guard(f(xl), c, xl), guard(f(xr), c, xr)];
      },
      () => guard(f(mid), 1, mid),
      opts,
    );
    return { ...r, value: r.value * half, error: r.error * half };
  }

  if (aFinite) {
    // [a, ∞): x = a + s/(1−s), s ∈ [0, 1); map s = (1+τ)/2 onto τ ∈ (−1, 1).
    // In terms of the node complement c: left node s = c/2, right node 1−s = c/2.
    return mapped(f, opts, (c, side) => {
      const s = side === "L" ? c / 2 : 1 - c / 2;
      const oneMinusS = side === "L" ? 1 - c / 2 : c / 2;
      return { x: a + s / oneMinusS, jac: 1 / (oneMinusS * oneMinusS) / 2 };
    });
  }
  if (bFinite) {
    // (−∞, b]: x = b − s/(1−s).
    return mapped(f, opts, (c, side) => {
      const s = side === "L" ? c / 2 : 1 - c / 2;
      const oneMinusS = side === "L" ? 1 - c / 2 : c / 2;
      return { x: b - s / oneMinusS, jac: 1 / (oneMinusS * oneMinusS) / 2 };
    });
  }
  // (−∞, ∞): x = τ/(1−τ²), τ ∈ (−1, 1). Near τ = ±1, 1−τ = c and 1+τ = 2−c.
  return mapped(f, opts, (c, side) => {
    const tau = side === "L" ? -(1 - c) : 1 - c;
    const oneMinusTau2 = c * (2 - c);
    return { x: tau / oneMinusTau2, jac: (1 + tau * tau) / (oneMinusTau2 * oneMinusTau2) };
  });
}

function mapped(
  f: (x: number) => number,
  opts: QuadratureOptions,
  map: (c: number, side: "L" | "R") => { x: number; jac: number },
): QuadratureResult {
  const at = (c: number, side: "L" | "R") => {
    const { x, jac } = map(c, side);
    if (!Number.isFinite(x) || !Number.isFinite(jac)) return 0;
    const fx = f(x);
    if (fx === 0) return 0;
    return guard(fx * jac, c, x);
  };
  // The "center" is τ = 0, i.e. c = 1 on either side.
  return tanhSinhUnit((c) => [at(c, "L"), at(c, "R")], () => at(1, "R"), opts);
}
