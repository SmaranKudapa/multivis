import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ReactNode } from "react";
import { Axes } from "./Axes";

interface SceneRootProps {
  children: ReactNode;
}

/**
 * Shared 3D canvas for both integral types: light background, colored
 * axes, floor grid, and orbit controls. Math (x, y, z) maps to three.js
 * (x, z, y) here -- three.js's vertical axis carries height/the z variable,
 * so both the double-integral surface and the triple-integral solid sit
 * upright the way the reference GeoGebra-style plots do.
 */
export function SceneRoot({ children }: SceneRootProps) {
  return (
    <Canvas camera={{ position: [6, 4.5, 6], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 4]} intensity={1} />
      <directionalLight position={[-4, -3, -5]} intensity={0.3} />
      <gridHelper args={[16, 16, "#d8d8d8", "#eaeaea"]} />
      <Axes />
      {children}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
