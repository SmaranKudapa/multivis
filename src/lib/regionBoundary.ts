import { safeBounds } from "./safeBounds";

export interface BoundaryPoint {
  outer: number;
  inner: number;
}

/**
 * Traces one point on the closed boundary of a type-I region (outer in
 * [outerMin, outerMax], inner between lowerAt(outer) and upperAt(outer)),
 * for continuous t in [0, 4): along the lower curve (t in [0,1)), up the
 * right edge ([1,2)), back along the upper curve ([2,3)), down the left
 * edge ([3,4)). Works whether the two curves meet at the ends (a disk-like
 * region, where the "edges" collapse to a point) or not (a rectangle-like
 * region, with real vertical edges).
 *
 * Bounds are run through safeBounds() before use: a bound can legitimately
 * be undefined for part of the outer range (e.g. sqrt(1-x^2) once x>1)
 * without the integral itself being invalid -- it just means the region
 * doesn't extend there. Left as NaN, that would poison every bounding-box
 * calculation downstream and make the whole graph silently disappear.
 */
export function boundaryPointAt(
  t: number,
  outerMin: number,
  outerMax: number,
  lowerAt: (outer: number) => number,
  upperAt: (outer: number) => number,
): BoundaryPoint {
  const seg = Math.min(3, Math.floor(t));
  const frac = t - seg;

  if (seg === 0) {
    const outer = outerMin + frac * (outerMax - outerMin);
    const [lo] = safeBounds(lowerAt(outer), upperAt(outer));
    return { outer, inner: lo };
  }
  if (seg === 1) {
    const [lo, hi] = safeBounds(lowerAt(outerMax), upperAt(outerMax));
    return { outer: outerMax, inner: lo + frac * (hi - lo) };
  }
  if (seg === 2) {
    const outer = outerMax - frac * (outerMax - outerMin);
    const [, hi] = safeBounds(lowerAt(outer), upperAt(outer));
    return { outer, inner: hi };
  }
  const [lo, hi] = safeBounds(lowerAt(outerMin), upperAt(outerMin));
  return { outer: outerMin, inner: hi + frac * (lo - hi) };
}

/** Samples `boundaryPointAt` at `segments` evenly-spaced steps, as a closed loop (first point == last point). */
export function sampleTypeIBoundary(
  outerMin: number,
  outerMax: number,
  lowerAt: (outer: number) => number,
  upperAt: (outer: number) => number,
  segments = 120,
): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(boundaryPointAt((4 * i) / segments, outerMin, outerMax, lowerAt, upperAt));
  }
  return points;
}
