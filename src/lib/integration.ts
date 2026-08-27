import type { ScalarFn } from "./parser";

/**
 * One level of nested integration, outer-to-inner. `lower`/`upper` receive
 * a scope containing only the *outer* levels' values (the ones bound so
 * far), since inner bounds may depend on them (e.g. y = g(x)).
 */
export interface IntegralLevel {
  varName: string;
  lower: ScalarFn;
  upper: ScalarFn;
}

export interface IntegralCell {
  /** Midpoint sample location, keyed by variable name (x, y, z as present). */
  point: Record<string, number>;
  /** Cell width along each variable at this point. */
  size: Record<string, number>;
  value: number;
}

export interface IntegralResult {
  total: number;
  cells: IntegralCell[];
  validCellCount: number;
  invalidCellCount: number;
}

/**
 * Generic n-level (n=2 for double, n=3 for triple) nested midpoint Riemann
 * sum. Nesting order drives the loop/scope-building order (inner bounds can
 * reference outer variables), but each resulting cell carries concrete
 * values for every variable -- so callers (rendering, in particular) never
 * need to know which level was "outer" vs "inner", only which variable is
 * which.
 */
export function computeIntegral(f: ScalarFn, levels: IntegralLevel[], resolutions: number[]): IntegralResult {
  const cells: IntegralCell[] = [];
  let total = 0;
  let validCellCount = 0;
  let invalidCellCount = 0;

  function remainingLeafCount(fromLevel: number): number {
    let count = 1;
    for (let i = fromLevel; i < resolutions.length; i++) count *= Math.max(1, Math.round(resolutions[i]));
    return count;
  }

  function recurse(levelIdx: number, scope: Record<string, number>, cellVolume: number, size: Record<string, number>) {
    if (levelIdx === levels.length) {
      const value = f(scope);
      if (!Number.isFinite(value)) {
        invalidCellCount++;
        return;
      }
      cells.push({ point: { ...scope }, size: { ...size }, value });
      total += value * cellVolume;
      validCellCount++;
      return;
    }

    const level = levels[levelIdx];
    const lo = level.lower(scope);
    const hi = level.upper(scope);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      invalidCellCount += remainingLeafCount(levelIdx);
      return;
    }

    const n = Math.max(1, Math.round(resolutions[levelIdx]));
    const step = (hi - lo) / n;
    for (let k = 0; k < n; k++) {
      const mid = lo + (k + 0.5) * step;
      recurse(
        levelIdx + 1,
        { ...scope, [level.varName]: mid },
        cellVolume * step,
        { ...size, [level.varName]: step },
      );
    }
  }

  recurse(0, {}, 1, {});

  return { total, cells, validCellCount, invalidCellCount };
}
