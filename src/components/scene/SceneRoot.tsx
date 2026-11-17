import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Billboard, OrbitControls, Text } from "@react-three/drei";
import { computeNiceTicks } from "../../lib/graph/niceTicks";
import { formatNumber } from "../../lib/math/format";
import { AXIS_COLORS } from "../../lib/graph/frame2d";
import type { SceneScale } from "../../lib/graph/sceneScale";

interface SceneRootProps {
  sceneScale: SceneScale;
  /** Names for the math x, y, z axes. */
  labels: [string, string, string];
  children: ReactNode;
}

/**
 * Shared 3D canvas. Children are given in *math* coordinates (z up,
 * right-handed); the scene rotates them into three.js's y-up frame and
 * applies the auto-scale, so geometry code never thinks about either.
 */
export function SceneRoot({ sceneScale, labels, children }: SceneRootProps) {
  const { center, scale } = sceneScale;
  return (
    <Canvas camera={{ position: [7, 5.5, -7], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 10, -4]} intensity={0.9} />
      <directionalLight position={[-6, -4, 5]} intensity={0.35} />
      {/* math (x, y, z) -> three (x, z, -y) */}
      <group rotation-x={-Math.PI / 2}>
        <group scale={scale} position={[-center[0] * scale[0], -center[1] * scale[1], -center[2] * scale[2]]}>
          {children}
        </group>
        <Axes3D sceneScale={sceneScale} labels={labels} />
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

function Axes3D({ sceneScale, labels }: { sceneScale: SceneScale; labels: [string, string, string] }) {
  const { center, scale, min, max } = sceneScale;
  const toScene = (p: [number, number, number]): [number, number, number] => [
    (p[0] - center[0]) * scale[0],
    (p[1] - center[1]) * scale[1],
    (p[2] - center[2]) * scale[2],
  ];

  const ticks = useMemo(() => [0, 1, 2].map((i) => computeNiceTicks(min[i], max[i], 5)), [min, max]);

  const grid = useMemo(() => {
    const pts: number[] = [];
    for (const t of ticks[0]) pts.push(...toScene([t, min[1], 0]), ...toScene([t, max[1], 0]));
    for (const t of ticks[1]) pts.push(...toScene([min[0], t, 0]), ...toScene([max[0], t, 0]));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, sceneScale]);

  const axisColor = (i: number) => AXIS_COLORS[labels[i]] ?? "#6b7280";
  const axisLine = (i: number) => {
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [0, 0, 0];
    a[i] = min[i];
    b[i] = max[i];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...toScene(a), ...toScene(b)], 3));
    return g;
  };

  return (
    <group>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#e5e7eb" />
      </lineSegments>
      {[0, 1, 2].map((i) => {
        const end: [number, number, number] = [0, 0, 0];
        end[i] = max[i];
        const labelPos = toScene(end);
        labelPos[i] += 0.35;
        return (
          <group key={i}>
            <lineSegments geometry={axisLine(i)}>
              <lineBasicMaterial color={axisColor(i)} />
            </lineSegments>
            <Billboard position={labelPos}>
              <Text fontSize={0.36} color={axisColor(i)} anchorX="center" anchorY="middle">
                {labels[i]}
              </Text>
            </Billboard>
            {ticks[i]
              .filter((t) => Math.abs(t) > 1e-12)
              .map((t) => {
                const p: [number, number, number] = [0, 0, 0];
                p[i] = t;
                const pos = toScene(p);
                // Nudge labels off the axis line.
                if (i === 2) pos[0] += 0.22;
                else pos[2] -= 0.22;
                return (
                  <Billboard key={t} position={pos}>
                    <Text fontSize={0.22} color="#4b5563" anchorX="center" anchorY="middle">
                      {formatNumber(t)}
                    </Text>
                  </Billboard>
                );
              })}
          </group>
        );
      })}
    </group>
  );
}
