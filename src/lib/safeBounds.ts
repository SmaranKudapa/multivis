/**
 * Sanitizes a [lower, upper] pair for rendering: a bound can legitimately
 * evaluate to NaN (e.g. sqrt(1-x^2) once x>1) at some points along an
 * otherwise-valid region -- that's not malformed input, it just means the
 * region doesn't extend there. Left alone, a single NaN poisons every
 * downstream Math.min/Math.max bounding-box calculation, which is why a
 * graph can go from "renders a partial shape" to "renders nothing, no
 * error" with no warning. Clamping to a zero-width slice at that point
 * keeps geometry-building code finite and gives an honest "pinches to
 * nothing" visual instead.
 */
export function safeBounds(lower: number, upper: number): [number, number] {
  const lowerOk = Number.isFinite(lower);
  const upperOk = Number.isFinite(upper);
  if (lowerOk && upperOk) return [lower, upper];
  if (lowerOk) return [lower, lower];
  if (upperOk) return [upper, upper];
  return [0, 0];
}
