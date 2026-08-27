import * as THREE from "three";

// Cool-to-warm diverging colormap stops (blue -> teal -> yellow -> red).
const STOPS = [
  new THREE.Color("#3b4cc0"),
  new THREE.Color("#7aa6f5"),
  new THREE.Color("#dcdcdc"),
  new THREE.Color("#f5a26e"),
  new THREE.Color("#b40426"),
];

/** Maps t in [0,1] to a color along the diverging scale. */
export function colormap(t: number): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (STOPS.length - 1);
  const idx = Math.min(STOPS.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  return STOPS[idx].clone().lerp(STOPS[idx + 1], frac);
}

/** Builds a [0,1] normalizer from a set of raw values (handles a flat/zero range). */
export function makeNormalizer(values: number[]): (v: number) => number {
  if (values.length === 0) return () => 0.5;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range < 1e-9) return () => 0.5;
  return (v: number) => (v - min) / range;
}
