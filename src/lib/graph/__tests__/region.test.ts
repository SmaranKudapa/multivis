import { describe, expect, it } from "vitest";
import { analyzeIntegral } from "../../math/analyze";
import { computeClips, makeRegionMapper, unitSquareLoop, valuesByName } from "../region";
import { computeSceneScale } from "../sceneScale";
import * as THREE from "three";

function okIntegral(latex: string) {
  const r = analyzeIntegral(latex);
  if (r.status !== "ok") throw new Error("expected ok");
  return r;
}

describe("region mapper", () => {
  it("maps unit parameters onto an iterated region (y from x² to √x)", () => {
    const r = okIntegral(String.raw`\int_0^1\int_{x^2}^{\sqrt{x}} 1\,dy\,dx`);
    const map = makeRegionMapper(r.integral, computeClips(r.ranges));
    const [x, y] = map([0.5, 0]);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.25);
    expect(map([0.5, 1])[1]).toBeCloseTo(Math.sqrt(0.5));
  });

  it("puts polar points in the xy-plane", () => {
    const r = okIntegral(String.raw`\int_0^{2\pi}\int_0^2 r\,dr\,d\theta`);
    const map = makeRegionMapper(r.integral, computeClips(r.ranges));
    const values = map([0.25, 1]); // θ = π/2, r = 2
    const [x, y] = r.integral.system.toPoint(valuesByName(r.integral, values));
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(2);
  });

  it("clips infinite bounds to a finite window", () => {
    const r = okIntegral(String.raw`\int_0^\infty\int_0^1 e^{-x}\,dy\,dx`);
    const clips = computeClips(r.ranges);
    expect(clips[0].lo).toBe(-Infinity);
    expect(clips[0].hi).toBe(3);
    const map = makeRegionMapper(r.integral, clips);
    expect(map([1, 0])[0]).toBe(3);
  });

  it("walks the unit square boundary counter-clockwise", () => {
    expect(unitSquareLoop(0)).toEqual([0, 0]);
    expect(unitSquareLoop(1)).toEqual([1, 0]);
    expect(unitSquareLoop(2)).toEqual([1, 1]);
    expect(unitSquareLoop(3)).toEqual([0, 1]);
    expect(unitSquareLoop(3.5)).toEqual([0, 0.5]);
  });
});

describe("scene scale", () => {
  it("keeps horizontal axes equal and flags a stretched vertical axis", () => {
    const flat = computeSceneScale(new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(1, 1, 100)));
    expect(flat.scale[0]).toBe(flat.scale[1]);
    expect(flat.nonUniform).toBe(true);
    const cube = computeSceneScale(new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)));
    expect(cube.nonUniform).toBe(false);
  });
});
