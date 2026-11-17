import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CompiledIntegral } from "../../lib/math/analyze";
import { makeDensity, makeRegionMapper, valuesByName, type ViewClip } from "../../lib/graph/region";
import { boundsOf, buildParametricGeometry, colorByScalars, scalarRange } from "../../lib/graph/parametricSurface";
import { SceneRoot } from "./SceneRoot";
import { computeSceneScale } from "../../lib/graph/sceneScale";
import { ColorLegend } from "./ColorLegend";

interface SolidSceneProps {
  integral: CompiledIntegral;
  clips: ViewClip[];
}

const FACE_SEGMENTS = 36;
const EDGE_SAMPLES = 48;

/**
 * Triple integral: the solid of integration, in any coordinate system. The
 * region is the image of the unit cube under the region mapper (then
 * through cylindrical/spherical -> xyz), so its surface is the image of the
 * cube's six faces and its edges the image of the cube's twelve edges.
 * When the integrand isn't constant, the surface is colored by its value
 * (think: density).
 */
export function SolidScene({ integral, clips }: SolidSceneProps) {
  const built = useMemo(() => {
    const mapper = makeRegionMapper(integral, clips);
    // Density = integrand ÷ Jacobian: ρ² sin φ in a spherical volume integral is not "density", it's the volume element.
    const density = makeDensity(integral, clips);
    const params = new Float64Array(3);
    const pointAt = (p: ArrayLike<number>) => {
      const values = mapper(p);
      return { xyz: integral.system.toPoint(valuesByName(integral, values)), f: density(p) };
    };

    const faces: THREE.BufferGeometry[] = [];
    for (let fixed = 0; fixed < 3; fixed++) {
      const [a, b] = [0, 1, 2].filter((i) => i !== fixed);
      // A full revolution (θ from 0 to 2π) makes the two θ-faces the same interior seam -- skip them.
      if (opposingFacesCoincide(fixed, a, b, (p) => pointAt(p).xyz)) continue;
      for (const side of [0, 1]) {
        const at = (u: number, v: number) => {
          params[fixed] = side;
          params[a] = u;
          params[b] = v;
          return pointAt(params);
        };
        faces.push(
          buildParametricGeometry(
            (u, v) => at(u, v).xyz,
            FACE_SEGMENTS,
            FACE_SEGMENTS,
            (u, v) => at(u, v).f,
          ),
        );
      }
    }

    // The 12 cube edges: one varying parameter, the other two at 0 or 1.
    const edges: number[] = [];
    for (let vary = 0; vary < 3; vary++) {
      const [a, b] = [0, 1, 2].filter((i) => i !== vary);
      for (const ca of [0, 1]) {
        for (const cb of [0, 1]) {
          let prev: number[] | null = null;
          for (let s = 0; s <= EDGE_SAMPLES; s++) {
            params[vary] = s / EDGE_SAMPLES;
            params[a] = ca;
            params[b] = cb;
            const p = pointAt(params).xyz;
            if (prev) edges.push(...prev, ...p);
            prev = p;
          }
        }
      }
    }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edges.map((v) => (Number.isFinite(v) ? v : 0)), 3),
    );

    const [min, max] = scalarRange(faces);
    const colored = max - min > 1e-6 * Math.max(1, Math.abs(max));
    if (colored) for (const f of faces) colorByScalars(f, min, max);
    return { faces, edgeGeometry, colored, min, max, box: boundsOf(faces) };
  }, [integral, clips]);

  useEffect(
    () => () => {
      built.faces.forEach((f) => f.dispose());
      built.edgeGeometry.dispose();
    },
    [built],
  );

  const sceneScale = useMemo(() => computeSceneScale(built.box), [built]);

  return (
    <>
      <SceneRoot sceneScale={sceneScale} labels={["x", "y", "z"]}>
        {built.faces.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial
              color={built.colored ? "#ffffff" : "#4f83cc"}
              vertexColors={built.colored}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              roughness={0.55}
              metalness={0.05}
              depthWrite={false}
            />
          </mesh>
        ))}
        <lineSegments geometry={built.edgeGeometry}>
          <lineBasicMaterial color="#1e3a8a" transparent opacity={0.6} />
        </lineSegments>
      </SceneRoot>
      {built.colored && <ColorLegend min={built.min} max={built.max} label="density" />}
      {sceneScale.nonUniform && <p className="scene-note">Vertical axis not to scale</p>}
    </>
  );
}

/** True when the param-cube faces at `fixed` = 0 and `fixed` = 1 land on the same points. */
function opposingFacesCoincide(fixed: number, a: number, b: number, toXYZ: (p: ArrayLike<number>) => number[]): boolean {
  const p = new Float64Array(3);
  let scale = 1e-9;
  let maxGap = 0;
  for (const u of [0.13, 0.5, 0.87]) {
    for (const v of [0.21, 0.5, 0.79]) {
      p[a] = u;
      p[b] = v;
      p[fixed] = 0;
      const q0 = toXYZ(p);
      p[fixed] = 1;
      const q1 = toXYZ(p);
      for (let i = 0; i < 3; i++) {
        maxGap = Math.max(maxGap, Math.abs(q0[i] - q1[i]));
        scale = Math.max(scale, Math.abs(q0[i]), Math.abs(q1[i]));
      }
    }
  }
  return maxGap < 1e-7 * scale;
}
