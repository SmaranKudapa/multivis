import { useMemo } from "react";
import * as THREE from "three";
import type { EvaluatedLevel } from "../../lib/evaluateIntegral";
import { buildParametricGeometry } from "../../lib/parametricSurface";
import { boundaryPointAt } from "../../lib/regionBoundary";
import { safeBounds } from "../../lib/safeBounds";

interface TripleIntegralVisualProps {
  levels: EvaluatedLevel[];
}

const CAP_SEGMENTS = 40;
const WALL_SEGMENTS_U = 100;
const WALL_SEGMENTS_V = 12;

/**
 * The bounded solid E itself: a top cap (innermost upper bound), a bottom
 * cap (innermost lower bound), and a side wall connecting them around the
 * boundary of the (outer, middle) base region D -- three meshes built with
 * the same tools as the double-integral view (buildParametricGeometry,
 * boundaryPointAt/safeBounds), just composed differently, since a solid's
 * shape depends only on its bounds, not the integrand.
 */
export function TripleIntegralVisual({ levels }: TripleIntegralVisualProps) {
  const [outer, middle, inner] = levels;

  const outerRange = useMemo(() => ({ min: outer.lowerFn({}), max: outer.upperFn({}) }), [outer]);

  const middleAt = (outerVal: number): [number, number] => {
    const scope = { [outer.varName]: outerVal };
    return safeBounds(middle.lowerFn(scope), middle.upperFn(scope));
  };

  const innerAt = (outerVal: number, middleVal: number): [number, number] => {
    const scope = { [outer.varName]: outerVal, [middle.varName]: middleVal };
    return safeBounds(inner.lowerFn(scope), inner.upperFn(scope));
  };

  const topGeometry = useMemo(() => {
    return buildParametricGeometry(
      (u, v) => {
        const outerVal = outerRange.min + u * (outerRange.max - outerRange.min);
        const [mLo, mHi] = middleAt(outerVal);
        const middleVal = mLo + v * (mHi - mLo);
        const [, zHi] = innerAt(outerVal, middleVal);
        return [outerVal, zHi, middleVal];
      },
      CAP_SEGMENTS,
      CAP_SEGMENTS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, middle, inner, outerRange]);

  const bottomGeometry = useMemo(() => {
    return buildParametricGeometry(
      (u, v) => {
        const outerVal = outerRange.min + u * (outerRange.max - outerRange.min);
        const [mLo, mHi] = middleAt(outerVal);
        const middleVal = mLo + v * (mHi - mLo);
        const [zLo] = innerAt(outerVal, middleVal);
        return [outerVal, zLo, middleVal];
      },
      CAP_SEGMENTS,
      CAP_SEGMENTS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, middle, inner, outerRange]);

  const wallGeometry = useMemo(() => {
    const lowerAt = (o: number) => middleAt(o)[0];
    const upperAt = (o: number) => middleAt(o)[1];
    return buildParametricGeometry(
      (u, v) => {
        const { outer: outerVal, inner: middleVal } = boundaryPointAt(
          u * 4,
          outerRange.min,
          outerRange.max,
          lowerAt,
          upperAt,
        );
        const [zLo, zHi] = innerAt(outerVal, middleVal);
        const z = zLo + v * (zHi - zLo);
        return [outerVal, z, middleVal];
      },
      WALL_SEGMENTS_U,
      WALL_SEGMENTS_V,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outer, middle, inner, outerRange]);

  const solidMaterial = (
    <meshStandardMaterial
      color="#4f83cc"
      transparent
      opacity={0.55}
      side={THREE.DoubleSide}
      roughness={0.5}
      metalness={0.05}
    />
  );

  return (
    <group>
      <mesh geometry={topGeometry}>{solidMaterial}</mesh>
      <mesh geometry={bottomGeometry}>{solidMaterial}</mesh>
      <mesh geometry={wallGeometry}>{solidMaterial}</mesh>
    </group>
  );
}
