export interface BoundaryPoint {
  outer: number;
  inner: number;
}

/**
 * Traces the closed boundary of a type-I region (outer in [outerMin,
 * outerMax], inner between lowerAt(outer) and upperAt(outer)) as one loop:
 * along the lower curve, up the right edge, back along the upper curve,
 * down the left edge. Works whether the two curves meet at the ends (a
 * disk-like region, where the "edges" collapse to a point) or not (a
 * rectangle-like region, with real vertical edges). Used for the 2D bounds
 * view now, and reusable later for the triple-integral solid's side wall.
 */
export function sampleTypeIBoundary(
  outerMin: number,
  outerMax: number,
  lowerAt: (outer: number) => number,
  upperAt: (outer: number) => number,
  segments = 120,
): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (4 * i) / segments;
    const seg = Math.min(3, Math.floor(t));
    const frac = t - seg;

    let outer: number;
    let inner: number;
    if (seg === 0) {
      outer = outerMin + frac * (outerMax - outerMin);
      inner = lowerAt(outer);
    } else if (seg === 1) {
      outer = outerMax;
      inner = lowerAt(outerMax) + frac * (upperAt(outerMax) - lowerAt(outerMax));
    } else if (seg === 2) {
      outer = outerMax - frac * (outerMax - outerMin);
      inner = upperAt(outer);
    } else {
      outer = outerMin;
      inner = upperAt(outerMin) + frac * (lowerAt(outerMin) - upperAt(outerMin));
    }
    points.push({ outer, inner });
  }
  return points;
}
