import * as THREE from "three";

/**
 * Builds a triangulated surface from a (u, v) in [0,1]x[0,1] -> [x, y, z]
 * map. Every integration domain here is a type-I region (x in [xMin,xMax],
 * y between two functions of x) or the boundary of one, which is always
 * expressible as a map from the unit square -- so this one helper builds
 * the integrand surface, the base region, and (later) the solid's top/
 * bottom/side surfaces for triple integrals.
 */
export function buildParametricGeometry(
  map: (u: number, v: number) => [number, number, number],
  segsU: number,
  segsV: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segsV; j++) {
    const v = j / segsV;
    for (let i = 0; i <= segsU; i++) {
      const u = i / segsU;
      const [x, y, z] = map(u, v);
      positions.push(x, y, z);
    }
  }

  const cols = segsU + 1;
  for (let j = 0; j < segsV; j++) {
    for (let i = 0; i < segsU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
