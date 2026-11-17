import * as THREE from "three";

/** How many scene units the scene's largest horizontal extent is scaled to. */
const TARGET = 6;

export interface SceneScale {
  center: [number, number, number];
  scale: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  /** True when the vertical axis was stretched/squashed relative to the horizontal ones. */
  nonUniform: boolean;
}

/**
 * Picks a scale so any region, from a speck to a stadium, fills the view.
 * The horizontal axes always share one scale (shapes stay true); the
 * vertical axis gets its own only when keeping it equal would make the
 * picture absurdly flat or tall.
 */
export function computeSceneScale(box: THREE.Box3): SceneScale {
  const min = box.isEmpty() ? new THREE.Vector3(-1, -1, -1) : box.min.clone();
  const max = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.max.clone();
  min.min(new THREE.Vector3(0, 0, 0));
  max.max(new THREE.Vector3(0, 0, 0));
  const size = new THREE.Vector3().subVectors(max, min);
  for (const axis of ["x", "y", "z"] as const) {
    if (size[axis] < 1e-9) {
      min[axis] -= 0.5;
      max[axis] += 0.5;
      size[axis] = 1;
    }
  }
  const pad = size.clone().multiplyScalar(0.08);
  min.sub(pad);
  max.add(pad);
  size.subVectors(max, min);

  const sh = TARGET / Math.max(size.x, size.y);
  let sz = sh;
  const height = size.z * sh;
  let nonUniform = false;
  if (height > TARGET * 1.6 || height < TARGET * 0.25) {
    sz = (TARGET * 0.75) / size.z;
    nonUniform = true;
  }
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  return {
    center: [center.x, center.y, center.z],
    scale: [sh, sh, sz],
    min: [min.x, min.y, min.z],
    max: [max.x, max.y, max.z],
    nonUniform,
  };
}
