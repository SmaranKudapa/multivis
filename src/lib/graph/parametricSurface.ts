import * as THREE from "three";
import { colormap } from "./colormap";

/**
 * Builds a triangulated surface from a (u, v) ∈ [0,1]² -> [x, y, z] map.
 * Every region here is the image of a unit square (or a face of a unit
 * cube) under the region mapper, so this one helper builds the integrand
 * surface, the base region, the side walls and every face of a solid.
 *
 * With `scalarAt`, each vertex also gets a scalar (e.g. the integrand's
 * value there), stored in `geometry.userData.scalars` for colorByScalars().
 * Non-finite positions are replaced by the origin so one bad sample can't
 * poison the whole mesh (NaN positions make three.js drop it silently).
 */
export function buildParametricGeometry(
  map: (u: number, v: number) => [number, number, number] | number[],
  segsU: number,
  segsV: number,
  scalarAt?: (u: number, v: number) => number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const scalars: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segsV; j++) {
    const v = j / segsV;
    for (let i = 0; i <= segsU; i++) {
      const u = i / segsU;
      const [x, y, z] = map(u, v);
      positions.push(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0, Number.isFinite(z) ? z : 0);
      if (scalarAt) scalars.push(scalarAt(u, v));
    }
  }

  const cols = segsU + 1;
  for (let j = 0; j < segsV; j++) {
    for (let i = 0; i < segsU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (scalarAt) geometry.userData.scalars = scalars;
  return geometry;
}

/** [min, max] of the finite scalars across several geometries. */
export function scalarRange(geometries: THREE.BufferGeometry[]): [number, number] {
  const all: number[] = [];
  for (const g of geometries) {
    const s = g.userData.scalars as number[] | undefined;
    if (s) for (const v of s) if (Number.isFinite(v)) all.push(v);
  }
  if (all.length === 0) return [0, 0];
  all.sort((a, b) => a - b);
  const lo = all[0];
  const hi = all[all.length - 1];
  return [lo, hi];
}

/** Writes per-vertex colors from the stored scalars, mapped through the colormap over [min, max]. */
export function colorByScalars(geometry: THREE.BufferGeometry, min: number, max: number): void {
  const scalars = geometry.userData.scalars as number[] | undefined;
  if (!scalars) return;
  const colors = new Float32Array(scalars.length * 3);
  const range = max - min;
  scalars.forEach((s, i) => {
    const t = range > 1e-12 && Number.isFinite(s) ? (s - min) / range : 0.5;
    const c = colormap(t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

/** Axis-aligned bounds of several geometries' positions. */
export function boundsOf(geometries: THREE.BufferGeometry[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const g of geometries) {
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
  }
  return box;
}
