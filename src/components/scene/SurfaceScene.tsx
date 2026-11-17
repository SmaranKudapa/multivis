import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CompiledIntegral } from "../../lib/math/analyze";
import { displayVar } from "../../lib/math/coords";
import { makeDensity, makeRegionMapper, unitSquareLoop, valuesByName, type ViewClip } from "../../lib/graph/region";
import { boundsOf, buildParametricGeometry, colorByScalars, scalarRange } from "../../lib/graph/parametricSurface";
import { SceneRoot } from "./SceneRoot";
import { computeSceneScale } from "../../lib/graph/sceneScale";
import { ColorLegend } from "./ColorLegend";

interface SurfaceSceneProps {
  integral: CompiledIntegral;
  clips: ViewClip[];
}

const SEGMENTS = 56;
const WALL_SEGMENTS = 240;

/**
 * Double integral as a volume: the region on the floor, the surface
 * height = f above (or below) it, and vertical walls joining the two around
 * the region's edge -- the solid whose signed volume the integral measures.
 */
export function SurfaceScene({ integral, clips }: SurfaceSceneProps) {
  const { system } = integral;

  const built = useMemo(() => {
    const mapper = makeRegionMapper(integral, clips);
    // Height = integrand ÷ Jacobian, so the drawn volume equals the integral (matters for polar).
    const density = makeDensity(integral, clips);
    const sample = (u: number, v: number) => {
      const values = mapper([u, v]);
      const [h, w] = system.toPoint(valuesByName(integral, values));
      return { h, w, f: density([u, v]) };
    };

    const surface = buildParametricGeometry(
      (u, v) => {
        const p = sample(u, v);
        return [p.h, p.w, p.f];
      },
      SEGMENTS,
      SEGMENTS,
      (u, v) => sample(u, v).f,
    );
    const floor = buildParametricGeometry(
      (u, v) => {
        const p = sample(u, v);
        return [p.h, p.w, 0];
      },
      SEGMENTS,
      SEGMENTS,
    );
    const walls = buildParametricGeometry(
      (t, s) => {
        const [u, v] = unitSquareLoop(t * 4);
        const p = sample(u, v);
        return [p.h, p.w, s * p.f];
      },
      WALL_SEGMENTS,
      1,
    );
    const [min, max] = scalarRange([surface]);
    const colored = max - min > 1e-9 * Math.max(1, Math.abs(max));
    if (colored) colorByScalars(surface, min, max);
    return { surface, floor, walls, colored, min, max, box: boundsOf([surface, floor]) };
  }, [integral, clips, system]);

  useEffect(
    () => () => {
      built.surface.dispose();
      built.floor.dispose();
      built.walls.dispose();
    },
    [built],
  );

  const sceneScale = useMemo(() => computeSceneScale(built.box), [built]);
  const isPolar = system.kind === "polar";
  const labels: [string, string, string] = isPolar
    ? ["x", "y", "z"]
    : [displayVar(system.axisVars[0]), displayVar(system.axisVars[1]), system.axisVars.includes("z") ? "f" : "z"];

  return (
    <>
      <SceneRoot sceneScale={sceneScale} labels={labels}>
        <mesh geometry={built.floor}>
          <meshStandardMaterial color="#8fb3e8" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh geometry={built.walls}>
          <meshStandardMaterial color="#6f9be0" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh geometry={built.surface}>
          <meshStandardMaterial
            color={built.colored ? "#ffffff" : "#4f83cc"}
            vertexColors={built.colored}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
      </SceneRoot>
      {built.colored && <ColorLegend min={built.min} max={built.max} label="height f" />}
      {sceneScale.nonUniform && <p className="scene-note">Vertical axis not to scale</p>}
    </>
  );
}
