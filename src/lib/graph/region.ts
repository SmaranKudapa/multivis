import type { CompiledIntegral, LevelRange } from "../math/analyze";
import { displayVar } from "../math/coords";
import { formatNumber } from "../math/format";

/** Visible window for one level's variable. Infinite only when the variable never reaches infinity. */
export interface ViewClip {
  lo: number;
  hi: number;
}

/**
 * Infinite regions can't be drawn, so each variable that reaches ±∞ gets
 * clipped a little way past its finite values: ∫_0^∞ shows 0 to 3, for
 * example. Variables with finite bounds aren't clipped at all.
 */
export function computeClips(ranges: LevelRange[]): ViewClip[] {
  return ranges.map((r) => {
    const min = Number.isFinite(r.min) ? r.min : 0;
    const max = Number.isFinite(r.max) ? r.max : 0;
    const pad = Math.max(3, (max - min) * 0.75);
    return { lo: r.hasNegInf ? min - pad : -Infinity, hi: r.hasPosInf ? max + pad : Infinity };
  });
}

export function clipNotes(ci: CompiledIntegral, clips: ViewClip[]): string[] {
  const notes: string[] = [];
  clips.forEach((clip, k) => {
    const v = ci.levels[k].varName;
    const shown = displayVar(v);
    const lo = Number.isFinite(clip.lo) ? `${formatNumber(clip.lo, v)} ≤ ` : "";
    const hi = Number.isFinite(clip.hi) ? ` ≤ ${formatNumber(clip.hi, v)}` : "";
    if (lo || hi) notes.push(`${lo}${shown}${hi}`);
  });
  return notes.length ? [`The region is infinite, so the graph only shows the part where ${notes.join(", ")}.`] : [];
}

/**
 * Returns a function mapping unit parameters (one per level, outer-to-inner,
 * each in [0, 1]) to actual variable values inside the region: the outer
 * variable sweeps its bounds, the next sweeps its bounds at that outer
 * value, and so on. This turns any iterated-integral region into the image
 * of a unit square/cube, which is all the geometry code needs.
 */
export function makeRegionMapper(ci: CompiledIntegral, clips: ViewClip[]): (params: ArrayLike<number>) => Float64Array {
  const n = ci.levels.length;
  return (params) => {
    const env = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const level = ci.levels[k];
      let lo = clamp(level.lower(env), clips[k]);
      let hi = clamp(level.upper(env), clips[k]);
      // Validation guarantees defined bounds; this only guards against points it didn't sample.
      if (!Number.isFinite(lo)) lo = Number.isFinite(hi) ? hi : 0;
      if (!Number.isFinite(hi)) hi = lo;
      env[k] = lo + params[k] * (hi - lo);
    }
    return env;
  };
}

function clamp(v: number, clip: ViewClip): number {
  return Math.min(Math.max(v, clip.lo), clip.hi);
}

/** Converts level-ordered values to the name-keyed record CoordSystem.toPoint expects. */
export function valuesByName(ci: CompiledIntegral, values: ArrayLike<number>): Record<string, number> {
  const out: Record<string, number> = {};
  ci.levels.forEach((l, k) => {
    out[l.varName] = values[k];
  });
  return out;
}

/**
 * Walks the boundary of the unit square once, counter-clockwise, for
 * t ∈ [0, 4]: bottom edge, right edge, top edge, left edge. Mapped through
 * the region mapper this traces the region's boundary.
 */
export function unitSquareLoop(t: number): [number, number] {
  const seg = Math.min(3, Math.floor(t));
  const f = t - seg;
  switch (seg) {
    case 0:
      return [f, 0];
    case 1:
      return [1, f];
    case 2:
      return [1 - f, 1];
    default:
      return [0, 1 - f];
  }
}

const EDGE_NUDGE = 1e-4;

/**
 * The quantity the graphs show at a point of the region: the integrand
 * divided by the coordinate system's Jacobian. For ∫∫ g r dr dθ that's g,
 * the true height over the xy-plane, so the drawn volume equals the
 * integral's value; for Cartesian integrals it's just the integrand.
 *
 * Where the Jacobian vanishes (r = 0, φ = 0, ...) the ratio is evaluated a
 * hair inside the region instead, which gives its limiting value.
 */
export function makeDensity(ci: CompiledIntegral, clips: ViewClip[]): (params: ArrayLike<number>) => number {
  const mapper = makeRegionMapper(ci, clips);
  const nudged = new Float64Array(ci.levels.length);
  const at = (params: ArrayLike<number>) => {
    const values = mapper(params);
    const g = ci.integrand(values);
    const j = ci.system.jacobian(valuesByName(ci, values));
    return { g, j };
  };
  return (params) => {
    let { g, j } = at(params);
    // Step every parameter toward the middle of the region, further each try, until the Jacobian is nonzero.
    for (let step = EDGE_NUDGE; Math.abs(j) < 1e-12 && step <= 0.011; step *= 10) {
      for (let k = 0; k < nudged.length; k++) nudged[k] = params[k] + (params[k] < 0.5 ? step : -step);
      ({ g, j } = at(nudged));
    }
    const d = g / j;
    return Number.isFinite(d) ? d : NaN;
  };
}
