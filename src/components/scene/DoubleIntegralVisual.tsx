import { useMemo } from "react";
import * as THREE from "three";
import type { EvaluatedLevel } from "../../lib/evaluateIntegral";
import type { ScalarFn } from "../../lib/parser";
import { buildParametricGeometry } from "../../lib/parametricSurface";

interface DoubleIntegralVisualProps {
  levels: EvaluatedLevel[];
  integrandFn: ScalarFn;
}

const SURFACE_SEGMENTS = 48;

/**
 * Volume-under-a-surface view: the shaded region D on the floor, and the
 * integrand surface z=f above it. levels[0] is the outer variable (its
 * bounds are constants), levels[1] the inner one (bounds may depend on the
 * outer variable) -- whichever two of x/y/z they actually are, the first
 * spans the three.js X axis, the second spans three.js Z (depth), and the
 * integrand value is the height (three.js Y).
 */
export function DoubleIntegralVisual({ levels, integrandFn }: DoubleIntegralVisualProps) {
  const [outer, inner] = levels;

  const outerRange = useMemo(() => {
    const min = outer.lowerFn({});
    const max = outer.upperFn({});
    return { min, max };
  }, [outer]);

  const innerAt = (outerVal: number) => {
    const scope = { [outer.varName]: outerVal };
    return { lo: inner.lowerFn(scope), hi: inner.upperFn(scope) };
  };

  const surfaceGeometry = useMemo(() => {
    return buildParametricGeometry(
      (u, v) => {
        const outerVal = outerRange.min + u * (outerRange.max - outerRange.min);
        const { lo, hi } = innerAt(outerVal);
        const innerVal = lo + v * (hi - lo);
        const height = integrandFn({ [outer.varName]: outerVal, [inner.varName]: innerVal });
        return [outerVal, Number.isFinite(height) ? height : 0, innerVal];
      },
      SURFACE_SEGMENTS,
      SURFACE_SEGMENTS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, inner, outerRange, integrandFn]);

  const baseGeometry = useMemo(() => {
    return buildParametricGeometry(
      (u, v) => {
        const outerVal = outerRange.min + u * (outerRange.max - outerRange.min);
        const { lo, hi } = innerAt(outerVal);
        const innerVal = lo + v * (hi - lo);
        return [outerVal, 0, innerVal];
      },
      SURFACE_SEGMENTS,
      SURFACE_SEGMENTS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, inner, outerRange]);

  return (
    <group>
      <mesh geometry={baseGeometry}>
        <meshStandardMaterial color="#5b8fe0" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={surfaceGeometry}>
        <meshStandardMaterial
          color="#4f83cc"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
