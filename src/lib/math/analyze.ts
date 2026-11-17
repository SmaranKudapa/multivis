import { parseIntegral } from "./parseIntegral";
import { freeVariables, type Node } from "./expression";
import { compile, isConstant, type CompiledFn } from "./compile";
import { ANGLE_VARS, VAR_LATEX, displayVar, type CoordSystem } from "./coords";
import { integrate, NonFiniteValueError, type QuadratureOptions } from "./quadrature";
import { formatNumber, formatPoint } from "./format";
import { capitalize, partName, type Problem } from "./problem";

export interface CompiledLevel {
  varName: string;
  lower: CompiledFn;
  upper: CompiledFn;
  lowerLatex: string;
  upperLatex: string;
}

export interface CompiledIntegral {
  system: CoordSystem;
  /** Outer-to-inner. Every compiled function takes `v` indexed by level: v[k] is levels[k]'s variable. */
  levels: CompiledLevel[];
  integrand: CompiledFn;
  integrandLatex: string;
  integrandConstant: boolean;
  integrandImplicit: boolean;
}

/** Range of finite bound values seen for one level's variable, plus whether it reaches ±∞. */
export interface LevelRange {
  min: number;
  max: number;
  hasNegInf: boolean;
  hasPosInf: boolean;
}

export type Analysis =
  | { status: "error"; problem: Problem }
  | {
      /** "ok": valid and graphable. "ungraphable": a legal integral (value shown) that doesn't describe a region. */
      status: "ok" | "ungraphable";
      integral: CompiledIntegral;
      value: number;
      errorEstimate: number;
      warnings: string[];
      ranges: LevelRange[];
      problem?: Problem;
    };

// ---------------------------------------------------------------------------
// Step 1: variable checks and compilation

function checkVariables(node: Node, allowed: string[], all: string[], part: string, levelIndex: number | null): string | null {
  const used = [...freeVariables(node)];
  for (const v of used) {
    if (allowed.includes(v)) continue;
    const shown = displayVar(v);
    if (v === "d") {
      return "There's a stray “d” here. Differentials like dx have to come at the very end of the integral, after the integrand.";
    }
    if (levelIndex !== null && all.includes(v)) {
      const own = all[levelIndex];
      if (levelIndex === 0) {
        return `The bounds of the outermost integral (${displayVar(own)}) have to be numbers — they can't depend on ${shown} or any other variable.`;
      }
      if (v === own) return `The ${part} can't depend on ${shown} itself.`;
      return `The ${part} can't use ${shown}, because ${shown} is integrated inside the ${displayVar(own)} integral (d${shown} comes before d${displayVar(own)}). Bounds can only use variables whose integrals are further out: here that's ${allowed.map(displayVar).join(", ")}.`;
    }
    const known = all.map(displayVar).join(", ");
    if (levelIndex === null) return `“${shown}” isn't one of this integral's variables (${known}).`;
    if (allowed.length === 0) return `“${shown}” isn't a variable here — the outermost bounds have to be numbers.`;
    return `“${shown}” isn't a variable here. This bound can use ${allowed.map(displayVar).join(", ")}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 2: bound validation by sampling the region

interface FlaggedSample {
  outer: number[];
}

interface BoundIssue {
  level: number;
  kind: "undefined-lower" | "undefined-upper" | "reversed";
  samples: FlaggedSample[];
}

function samplesAlong(lo: number, hi: number, count: number): number[] {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const out: number[] = [];
  if (Number.isFinite(a) && Number.isFinite(b)) {
    if (a === b) return [a];
    for (let j = 0; j < count; j++) out.push(a + ((b - a) * j) / (count - 1));
  } else if (Number.isFinite(a)) {
    for (let j = 0; j < count; j++) {
      const s = j / count;
      out.push(a + s / (1 - s));
    }
  } else if (Number.isFinite(b)) {
    for (let j = 0; j < count; j++) {
      const s = j / count;
      out.push(b - s / (1 - s));
    }
  } else {
    for (let j = 1; j < count; j++) {
      const tau = -1 + (2 * j) / count;
      out.push(tau / (1 - tau * tau));
    }
  }
  return out;
}

function isReversed(lo: number, hi: number): boolean {
  if (lo === hi) return false;
  const scale = Math.max(1, Math.abs(Number.isFinite(lo) ? lo : 0), Math.abs(Number.isFinite(hi) ? hi : 0));
  return hi < lo - 1e-9 * scale;
}

function validateBounds(ci: CompiledIntegral): { issues: BoundIssue[]; ranges: LevelRange[] } {
  const n = ci.levels.length;
  const ranges: LevelRange[] = ci.levels.map(() => ({ min: Infinity, max: -Infinity, hasNegInf: false, hasPosInf: false }));
  const issues = new Map<string, BoundIssue>();
  const env = new Float64Array(n);
  const samplesPerLevel = n === 3 ? [41, 41] : [241];

  const record = (k: number, kind: BoundIssue["kind"]) => {
    const key = `${k}:${kind}`;
    let issue = issues.get(key);
    if (!issue) {
      issue = { level: k, kind, samples: [] };
      issues.set(key, issue);
    }
    issue.samples.push({ outer: Array.from(env.slice(0, k)) });
  };

  const note = (k: number, value: number) => {
    const r = ranges[k];
    if (value === Infinity) r.hasPosInf = true;
    else if (value === -Infinity) r.hasNegInf = true;
    else if (Number.isFinite(value)) {
      r.min = Math.min(r.min, value);
      r.max = Math.max(r.max, value);
    }
  };

  const visit = (k: number) => {
    const level = ci.levels[k];
    const lo = level.lower(env);
    const hi = level.upper(env);
    let bad = false;
    if (Number.isNaN(lo)) {
      record(k, "undefined-lower");
      bad = true;
    }
    if (Number.isNaN(hi)) {
      record(k, "undefined-upper");
      bad = true;
    }
    if (bad) return;
    note(k, lo);
    note(k, hi);
    if (isReversed(lo, hi)) record(k, "reversed");
    if (k === n - 1) return;
    for (const value of samplesAlong(lo, hi, samplesPerLevel[k])) {
      env[k] = value;
      visit(k + 1);
    }
  };

  visit(0);
  return { issues: [...issues.values()], ranges };
}

/** Finds where `flagged` switches between `inside` (flagged) and `outside` (not) by bisection. */
function refineEdge(inside: number, outside: number, flagged: (v: number) => boolean): number {
  let a = inside;
  let b = outside;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (a + b) / 2;
    if (mid === a || mid === b) break;
    if (flagged(mid)) a = mid;
    else b = mid;
  }
  // Snap values that are a hair off a round number (0.9999999 -> 1).
  const snapped = Number(a.toPrecision(8));
  return Math.abs(snapped) < 1e-7 ? 0 : snapped;
}

/**
 * Groups the flagged values of a single outer variable into runs (using
 * the full ordered list of sampled values) and refines each run's edges to
 * where the condition actually starts/stops holding.
 */
function describeRuns(flaggedValues: number[], all: number[], varName: string, flagged: (v: number) => boolean): string {
  const flaggedSet = new Set(flaggedValues);
  const runs: [number, number][] = [];
  let start: number | null = null;
  for (let idx = 0; idx < all.length; idx++) {
    const v = all[idx];
    if (flaggedSet.has(v)) {
      if (start === null) start = idx;
    } else if (start !== null) {
      runs.push([start, idx - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, all.length - 1]);
  const refinedRuns = runs.map(([i0, i1]): [number, number] => [
    i0 > 0 ? refineEdge(all[i0], all[i0 - 1], flagged) : all[i0],
    i1 < all.length - 1 ? refineEdge(all[i1], all[i1 + 1], flagged) : all[i1],
  ]);
  return formatRuns(refinedRuns, varName);
}

function formatRuns(runs: [number, number][], varName: string): string {
  const shown = displayVar(varName);
  const parts = runs.slice(0, 2).map(([a, b]) =>
    a === b ? `${shown} = ${formatNumber(a, varName)}` : `${shown} is between ${formatNumber(a, varName)} and ${formatNumber(b, varName)}`,
  );
  if (runs.length > 2) parts.push("elsewhere");
  return parts.join(", and when ");
}

function issueLocation(ci: CompiledIntegral, issue: BoundIssue): string {
  const outerVars = ci.levels.slice(0, issue.level).map((l) => l.varName);
  if (issue.level === 1) {
    const lo0 = ci.levels[0].lower([]);
    const hi0 = ci.levels[0].upper([]);
    const all = samplesAlong(lo0, hi0, 241);
    const level = ci.levels[1];
    const flagged = (v: number) => {
      const lo = level.lower([v]);
      const hi = level.upper([v]);
      if (issue.kind === "undefined-lower") return Number.isNaN(lo);
      if (issue.kind === "undefined-upper") return Number.isNaN(hi);
      return !Number.isNaN(lo) && !Number.isNaN(hi) && isReversed(lo, hi);
    };
    return "when " + describeRuns(issue.samples.map((s) => s.outer[0]), all, outerVars[0], flagged);
  }
  const example = issue.samples[Math.floor(issue.samples.length / 2)];
  return `at some points in the region, for example at ${formatPoint(outerVars, example.outer)}`;
}

function boundIssueProblem(ci: CompiledIntegral, issue: BoundIssue): Problem {
  const level = ci.levels[issue.level];
  const shown = displayVar(level.varName);
  if (issue.kind === "reversed") {
    const partLatex = `${VAR_LATEX[level.varName]}\\text{ from }${level.lowerLatex}\\text{ to }${level.upperLatex}`;
    if (issue.level === 0) {
      return {
        title: "Legal integral, but it can't be graphed",
        message: `The upper bound of ${shown} is smaller than its lower bound. That's mathematically legal — swapping the bounds just flips the sign, so the value above is computed that way — but a range that runs backwards doesn't describe an actual region, so there's nothing to draw. Swap the two bounds to see the graph.`,
        part: `bounds of ${shown}`,
        partLatex,
      };
    }
    return {
      title: "Legal integral, but it can't be graphed",
      message: `The upper bound of ${shown} is smaller than its lower bound ${issueLocation(ci, issue)}. That's mathematically legal — the value above is a signed integral, where that part counts negatively — but bounds that cross like this don't describe an actual region, so there's nothing to draw. To graph it, make sure each upper bound is at least its lower bound everywhere (for example, split the integral where the bounds cross).`,
      part: `bounds of ${shown}`,
      partLatex,
    };
  }
  const kind = issue.kind === "undefined-lower" ? "lower" : "upper";
  const part = partName(kind, shown);
  const where =
    issue.level === 0
      ? ""
      : ` ${issueLocation(ci, issue)}`;
  return {
    title: `${capitalize(part)} is undefined${issue.level === 0 ? "" : " in part of the region"}`,
    message: `The ${part} can't be evaluated${where} — for example a square root of a negative number, a logarithm of zero or a negative number, or division by zero. ${
      issue.level === 0 ? "" : "Every bound has to be defined across the whole range of the variables outside it. "
    }This integral is invalid as written.`,
    part,
    partLatex: kind === "lower" ? level.lowerLatex : level.upperLatex,
  };
}

// ---------------------------------------------------------------------------
// Step 3: numerical integration

const OPTIONS: Record<number, QuadratureOptions[]> = {
  1: [{ tol: 1e-10, minLevel: 3, maxLevel: 9 }],
  2: [
    { tol: 1e-8, minLevel: 3, maxLevel: 7 },
    { tol: 1e-9, minLevel: 2, maxLevel: 7 },
  ],
  3: [
    { tol: 1e-7, minLevel: 3, maxLevel: 5 },
    { tol: 1e-8, minLevel: 2, maxLevel: 4 },
    { tol: 1e-8, minLevel: 2, maxLevel: 4 },
  ],
};

/** Tail-to-total ratio above which the integral is considered divergent. */
const DIVERGENT_TAIL = 0.3;
/** Above this, the result is flagged as possibly inaccurate (slowly convergent). */
const SLOW_TAIL = 1e-3;

class PointError extends Error {
  readonly level: number;
  readonly point: number[];
  readonly value: number;
  constructor(level: number, point: number[], value: number) {
    super("point error");
    this.level = level;
    this.point = point;
    this.value = value;
  }
}

class BoundAtPointError extends Error {
  readonly level: number;
  readonly kind: "lower" | "upper";
  readonly point: number[];
  constructor(level: number, kind: "lower" | "upper", point: number[]) {
    super("bound undefined");
    this.level = level;
    this.kind = kind;
    this.point = point;
  }
}

interface ValueResult {
  value: number;
  error: number;
  converged: boolean;
  outerTail: number;
  innerTail: { ratio: number; level: number; point: number[] } | null;
  innerUnconverged: number;
}

function computeValue(ci: CompiledIntegral): ValueResult {
  const n = ci.levels.length;
  const opts = OPTIONS[n];
  const env = new Float64Array(n);
  let innerTail: ValueResult["innerTail"] = null;
  let innerUnconverged = 0;

  const levelIntegral = (k: number): ReturnType<typeof integrate> => {
    const level = ci.levels[k];
    const lo = level.lower(env);
    const hi = level.upper(env);
    if (Number.isNaN(lo)) throw new BoundAtPointError(k, "lower", Array.from(env.slice(0, k)));
    if (Number.isNaN(hi)) throw new BoundAtPointError(k, "upper", Array.from(env.slice(0, k)));
    try {
      return integrate(
        (t) => {
          env[k] = t;
          if (k === n - 1) return ci.integrand(env);
          const inner = levelIntegral(k + 1);
          if (!inner.converged) innerUnconverged++;
          if (inner.tailRatio > SLOW_TAIL && (!innerTail || inner.tailRatio > innerTail.ratio)) {
            innerTail = { ratio: inner.tailRatio, level: k + 1, point: Array.from(env.slice(0, k + 1)) };
          }
          return inner.value;
        },
        lo,
        hi,
        opts[k],
      );
    } catch (err) {
      if (err instanceof NonFiniteValueError) {
        throw new PointError(k, Array.from(env.slice(0, k + 1)), err.value);
      }
      throw err;
    }
  };

  const r = levelIntegral(0);
  return {
    value: r.value,
    error: r.error,
    converged: r.converged,
    outerTail: r.tailRatio,
    innerTail,
    innerUnconverged,
  };
}

// ---------------------------------------------------------------------------

/**
 * The whole pipeline: LaTeX -> parsed parts -> compiled functions ->
 * validated region -> numeric value. Pure (no React), so it's directly
 * unit-testable.
 */
export function analyzeIntegral(latex: string): Analysis {
  const parsed = parseIntegral(latex);
  if (!parsed.ok) return { status: "error", problem: parsed.problem };
  const { system, levels, integrand, integrandLatex, integrandImplicit } = parsed.integral;
  const allVars = levels.map((l) => l.varName);

  // Variables and compilation.
  const compiledLevels: CompiledLevel[] = [];
  for (let k = 0; k < levels.length; k++) {
    const level = levels[k];
    const allowed = allVars.slice(0, k);
    for (const kind of ["lower", "upper"] as const) {
      const part = partName(kind, displayVar(level.varName));
      const msg = checkVariables(kind === "lower" ? level.lower : level.upper, allowed, allVars, part, k);
      if (msg) {
        return {
          status: "error",
          problem: {
            title: `${capitalize(part)} isn't valid`,
            message: msg,
            part,
            partLatex: kind === "lower" ? level.lowerLatex : level.upperLatex,
          },
        };
      }
    }
    compiledLevels.push({
      varName: level.varName,
      lower: compile(level.lower, allVars),
      upper: compile(level.upper, allVars),
      lowerLatex: level.lowerLatex,
      upperLatex: level.upperLatex,
    });
  }
  const integrandMsg = checkVariables(integrand, allVars, allVars, "integrand", null);
  if (integrandMsg) {
    return {
      status: "error",
      problem: { title: "The integrand isn't valid", message: integrandMsg, part: "integrand", partLatex: integrandLatex },
    };
  }

  const ci: CompiledIntegral = {
    system,
    levels: compiledLevels,
    integrand: compile(integrand, allVars),
    integrandLatex,
    integrandConstant: isConstant(integrand),
    integrandImplicit,
  };

  // Region checks.
  const { issues, ranges } = validateBounds(ci);
  const undefinedIssue = issues.find((i) => i.kind !== "reversed");
  if (undefinedIssue) return { status: "error", problem: boundIssueProblem(ci, undefinedIssue) };

  for (let k = 0; k < levels.length; k++) {
    const v = levels[k].varName;
    if (ANGLE_VARS.has(v) && (ranges[k].hasNegInf || ranges[k].hasPosInf)) {
      return {
        status: "error",
        problem: {
          title: `Infinite bound on the angle ${displayVar(v)}`,
          message: `${displayVar(v)} is an angle, so its bounds need to be finite (usually somewhere between 0 and 2π).`,
          part: `bounds of ${displayVar(v)}`,
        },
      };
    }
  }

  const warnings = regionWarnings(ci, ranges, integrand);

  // Value.
  let result: ValueResult;
  try {
    result = computeValue(ci);
  } catch (err) {
    if (err instanceof PointError) return { status: "error", problem: pointProblem(ci, err) };
    if (err instanceof BoundAtPointError) {
      const level = ci.levels[err.level];
      const part = partName(err.kind, displayVar(level.varName));
      return {
        status: "error",
        problem: {
          title: `${capitalize(part)} is undefined in part of the region`,
          message: `The ${part} can't be evaluated at ${formatPoint(allVars.slice(0, err.level), err.point)}, which is inside the region. Every bound has to be defined across the whole range of the variables outside it.`,
          part,
          partLatex: err.kind === "lower" ? level.lowerLatex : level.upperLatex,
        },
      };
    }
    throw err;
  }

  const divergent =
    !Number.isFinite(result.value) ||
    result.outerTail > DIVERGENT_TAIL ||
    (!result.converged && result.error > 1e-2 * Math.max(1, Math.abs(result.value)) && result.innerTail !== null);
  if (divergent) return { status: "error", problem: divergenceProblem(ci, result) };

  if (!result.converged && result.error > 1e-3 * Math.max(1e-6, Math.abs(result.value))) {
    return {
      status: "error",
      problem: {
        title: "Couldn't compute this integral reliably",
        message:
          "The numerical integration didn't settle on a value — the integrand may oscillate very rapidly, have a singularity inside the region, or the integral may diverge. Try simplifying the integrand or splitting the region.",
        part: "integral",
      },
    };
  }
  if (!result.converged || result.outerTail > SLOW_TAIL || (result.innerTail && result.innerTail.ratio > 0.05)) {
    warnings.push("This integral converges slowly (the integrand is nearly singular somewhere), so the last digits may be off.");
  } else if (result.innerUnconverged > 0 && levels.length > 1) {
    // Inner integrals that didn't fully converge at a few points barely affect the total; stay quiet unless large.
  }

  const reversed = issues.find((i) => i.kind === "reversed");
  const base = { integral: ci, value: result.value, errorEstimate: result.error, warnings, ranges };
  if (reversed) return { status: "ungraphable", ...base, problem: boundIssueProblem(ci, reversed) };
  return { status: "ok", ...base };
}

function pointProblem(ci: CompiledIntegral, err: PointError): Problem {
  const vars = ci.levels.map((l) => l.varName);
  const n = vars.length;
  const where = formatPoint(vars.slice(0, err.level + 1), err.point);
  if (err.level === n - 1) {
    const what = Number.isNaN(err.value)
      ? "can't be evaluated (for example a square root of a negative number, or a logarithm of zero or a negative number)"
      : "is infinite (division by zero)";
    return {
      title: "The integrand is undefined inside the region",
      message: `At ${where} the integrand ${what}, and that point is inside the region you're integrating over. Change the integrand or the bounds so the integrand is defined everywhere in the region.`,
      part: "integrand",
      partLatex: ci.integrandLatex,
    };
  }
  const innerVar = displayVar(vars[err.level + 1]);
  return {
    title: "This integral diverges",
    message: `The inner integral with respect to ${innerVar} is infinite at ${where}, so the whole integral has no finite value.`,
    part: "integrand",
    partLatex: ci.integrandLatex,
  };
}

function divergenceProblem(ci: CompiledIntegral, result: ValueResult): Problem {
  const vars = ci.levels.map((l) => l.varName);
  let where = "near an edge of the region (or out toward infinity)";
  if (result.innerTail && result.outerTail <= DIVERGENT_TAIL) {
    const inner = displayVar(vars[result.innerTail.level]);
    where = `in the ${inner} direction (for example when ${formatPoint(vars.slice(0, result.innerTail.level), result.innerTail.point)})`;
  }
  return {
    title: "This integral diverges",
    message: `Its value is infinite or doesn't exist: the integrand doesn't shrink fast enough ${where}. There's no finite value to compute, so nothing is graphed.`,
    part: "integrand",
    partLatex: ci.integrandLatex,
  };
}

function regionWarnings(ci: CompiledIntegral, ranges: LevelRange[], integrand: Node): string[] {
  const warnings: string[] = [];
  const { system } = ci;
  const rangeOf = (v: string) => {
    const k = ci.levels.findIndex((l) => l.varName === v);
    return k === -1 ? null : ranges[k];
  };

  if (system.jacobianVars) {
    const used = freeVariables(integrand);
    if (!system.jacobianVars.some((v) => used.has(v))) {
      const names = system.jacobianVars.map(displayVar).join(" or ");
      warnings.push(`${system.jacobianNote} Your integrand doesn't contain ${names}, so this probably isn't the ${system.dimension === 2 ? "area" : "volume"} you meant.`);
    }
  }

  const radiusVar = system.kind === "spherical" ? system.axisVars[0] : system.kind === "polar" || system.kind === "cylindrical" ? "r" : null;
  if (radiusVar) {
    const r = rangeOf(radiusVar);
    if (r && (r.min < 0 || r.hasNegInf)) {
      warnings.push(`${displayVar(radiusVar)} goes negative. That's allowed (points are reflected through the origin), but the picture may overlap itself.`);
    }
  }
  const theta = rangeOf("theta");
  if (theta && theta.max - theta.min > 2 * Math.PI + 1e-9) {
    warnings.push("θ covers more than a full turn (2π), so part of the region is counted more than once.");
  }
  const phi = rangeOf("phi");
  if (phi && (phi.min < -1e-9 || phi.max > Math.PI + 1e-9)) {
    warnings.push("φ is measured down from the +z axis, so it normally stays between 0 and π. Values outside that range double back over the same points.");
  }
  return warnings;
}
