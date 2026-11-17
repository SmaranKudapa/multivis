/**
 * The coordinate systems Multivis understands, detected from which
 * differentials an integral uses.
 *
 * Variable names are canonical: "x", "y", "z", "r", "theta", "rho", "phi".
 * Spherical coordinates use the US-calculus convention: φ is measured down
 * from the +z axis (0 ≤ φ ≤ π) and θ is the angle in the xy-plane.
 */

export type SystemKind = "cartesian1" | "cartesian2" | "cartesian3" | "polar" | "cylindrical" | "spherical";

export interface CoordSystem {
  kind: SystemKind;
  dimension: 1 | 2 | 3;
  label: string;
  /**
   * The variables in "axis order" -- the order their geometric axes are
   * drawn in. For cartesian2 that's e.g. ["x", "y"] (horizontal, vertical).
   */
  axisVars: string[];
  /** Area/volume element, shown as a reminder. */
  jacobianNote?: string;
  /** Variables at least one of which should appear in the integrand if the Jacobian was included. */
  jacobianVars?: string[];
  /** Maps variable values to a point: [h, v] for 1D/2D systems, [x, y, z] for 3D ones. */
  toPoint(values: Record<string, number>): number[];
  /**
   * |det| of the change of variables (r for polar/cylindrical, ρ² sin φ for
   * spherical, 1 otherwise). The integrand divided by this is the actual
   * height/density over xy(z)-space, which is what the graphs show.
   */
  jacobian(values: Record<string, number>): number;
}

export const VAR_DISPLAY: Record<string, string> = {
  x: "x",
  y: "y",
  z: "z",
  r: "r",
  theta: "θ",
  rho: "ρ",
  phi: "φ",
};

export const VAR_LATEX: Record<string, string> = {
  x: "x",
  y: "y",
  z: "z",
  r: "r",
  theta: "\\theta",
  rho: "\\rho",
  phi: "\\phi",
};

export const ANGLE_VARS = new Set(["theta", "phi"]);

export function displayVar(name: string): string {
  return VAR_DISPLAY[name] ?? name;
}

const AXIS_ORDER = ["x", "y", "z"];

function cartesian1(v: string): CoordSystem {
  return {
    kind: "cartesian1",
    dimension: 1,
    label: "Single integral",
    axisVars: [v],
    jacobian: () => 1,
    toPoint: (vals) => [vals[v]],
  };
}

function cartesian2(vars: string[]): CoordSystem {
  const [h, v] = [...vars].sort((a, b) => AXIS_ORDER.indexOf(a) - AXIS_ORDER.indexOf(b));
  return {
    kind: "cartesian2",
    dimension: 2,
    label: "Double integral (Cartesian)",
    axisVars: [h, v],
    jacobian: () => 1,
    toPoint: (vals) => [vals[h], vals[v]],
  };
}

const POLAR: CoordSystem = {
  kind: "polar",
  dimension: 2,
  label: "Double integral (polar)",
  axisVars: ["r", "theta"],
  jacobianNote: "In polar coordinates the area element is dA = r dr dθ, so the integrand needs an extra factor of r.",
  jacobianVars: ["r"],
  jacobian: (vals) => Math.abs(vals.r),
  toPoint: (vals) => [vals.r * Math.cos(vals.theta), vals.r * Math.sin(vals.theta)],
};

const CARTESIAN3: CoordSystem = {
  kind: "cartesian3",
  dimension: 3,
  label: "Triple integral (Cartesian)",
  axisVars: ["x", "y", "z"],
  jacobian: () => 1,
  toPoint: (vals) => [vals.x, vals.y, vals.z],
};

const CYLINDRICAL: CoordSystem = {
  kind: "cylindrical",
  dimension: 3,
  label: "Triple integral (cylindrical)",
  axisVars: ["r", "theta", "z"],
  jacobianNote: "In cylindrical coordinates the volume element is dV = r dz dr dθ, so the integrand needs an extra factor of r.",
  jacobianVars: ["r"],
  jacobian: (vals) => Math.abs(vals.r),
  toPoint: (vals) => [vals.r * Math.cos(vals.theta), vals.r * Math.sin(vals.theta), vals.z],
};

function spherical(radiusVar: "rho" | "r"): CoordSystem {
  const rv = radiusVar;
  const shown = displayVar(rv);
  return {
    kind: "spherical",
    dimension: 3,
    label: "Triple integral (spherical)",
    axisVars: [rv, "theta", "phi"],
    jacobianNote: `In spherical coordinates the volume element is dV = ${shown}² sin φ d${shown} dφ dθ (φ measured down from the +z axis), so the integrand needs an extra factor of ${shown}² sin φ.`,
    jacobianVars: [rv, "phi"],
    jacobian: (vals) => Math.abs(vals[rv] * vals[rv] * Math.sin(vals.phi)),
    toPoint: (vals) => {
      const rho = vals[rv];
      const s = Math.sin(vals.phi);
      return [rho * s * Math.cos(vals.theta), rho * s * Math.sin(vals.theta), rho * Math.cos(vals.phi)];
    },
  };
}

const sameSet = (vars: string[], wanted: string[]) =>
  vars.length === wanted.length && wanted.every((w) => vars.includes(w));

export type DetectResult = { ok: true; system: CoordSystem } | { ok: false; message: string };

/** Picks the coordinate system from the set of differential variables. */
export function detectSystem(vars: string[]): DetectResult {
  const shown = vars.map((v) => "d" + displayVar(v)).join(", ");
  if (vars.length === 1) {
    if (AXIS_ORDER.includes(vars[0])) return { ok: true, system: cartesian1(vars[0]) };
    return { ok: false, message: `A single integral has to be with respect to x, y or z (found ${shown}).` };
  }
  if (vars.length === 2) {
    if (vars.every((v) => AXIS_ORDER.includes(v))) return { ok: true, system: cartesian2(vars) };
    if (sameSet(vars, ["r", "theta"])) return { ok: true, system: POLAR };
    return {
      ok: false,
      message: `${shown} isn't a coordinate system Multivis knows. Double integrals can use two of dx, dy, dz (Cartesian) or dr and dθ (polar).`,
    };
  }
  if (sameSet(vars, ["x", "y", "z"])) return { ok: true, system: CARTESIAN3 };
  if (sameSet(vars, ["r", "theta", "z"])) return { ok: true, system: CYLINDRICAL };
  if (sameSet(vars, ["rho", "theta", "phi"])) return { ok: true, system: spherical("rho") };
  if (sameSet(vars, ["r", "theta", "phi"])) return { ok: true, system: spherical("r") };
  return {
    ok: false,
    message: `${shown} isn't a coordinate system Multivis knows. Triple integrals can use dx, dy, dz (Cartesian), dz, dr, dθ (cylindrical) or dρ, dφ, dθ (spherical).`,
  };
}
