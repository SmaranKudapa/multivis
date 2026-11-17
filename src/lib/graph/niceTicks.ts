/**
 * Picks human-friendly tick values (steps of 1/2/5 x a power of ten) across
 * [min, max], aiming for roughly `targetCount` ticks -- the standard
 * approach graphing libraries use so axis labels read as "0, 0.5, 1" rather
 * than some arbitrary fraction of the range.
 */
export function computeNiceTicks(min: number, max: number, targetCount = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  const rawStep = (max - min) / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;

  const step = niceResidual * magnitude;
  const start = Math.ceil(min / step) * step;

  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    const rounded = Math.round(v / step) * step;
    ticks.push(Object.is(rounded, -0) ? 0 : rounded);
  }
  return ticks;
}
