import { describe, expect, it } from "vitest";
import { buildParametricGeometry } from "../parametricSurface";

describe("buildParametricGeometry", () => {
  it("produces (segsU+1) * (segsV+1) vertices", () => {
    const geometry = buildParametricGeometry((u, v) => [u, 0, v], 4, 3);
    const position = geometry.getAttribute("position");
    expect(position.count).toBe(5 * 4);
  });

  it("produces two triangles (6 indices) per grid cell", () => {
    const segsU = 4;
    const segsV = 3;
    const geometry = buildParametricGeometry((u, v) => [u, 0, v], segsU, segsV);
    expect(geometry.index?.count).toBe(segsU * segsV * 6);
  });

  it("maps corner (u,v) values to the expected positions", () => {
    const geometry = buildParametricGeometry((u, v) => [10 * u, 5, 20 * v], 2, 2);
    const position = geometry.getAttribute("position");

    // (u=0, v=0) is vertex 0.
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([0, 5, 0]);

    // (u=1, v=1) is the last vertex.
    const last = position.count - 1;
    expect([position.getX(last), position.getY(last), position.getZ(last)]).toEqual([10, 5, 20]);
  });

  it("computes vertex normals", () => {
    const geometry = buildParametricGeometry((u, v) => [u, 0, v], 3, 3);
    const normal = geometry.getAttribute("normal");
    expect(normal).toBeDefined();
    expect(normal.count).toBe(geometry.getAttribute("position").count);
  });
});
