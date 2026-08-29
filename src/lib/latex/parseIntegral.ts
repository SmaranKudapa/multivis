import { stripLatexNoise } from "./latexToMathJs";

export type IntegralMode = "double" | "triple";

export interface IntegralLevel {
  /** The variable this level integrates over: "x", "y", or "z". */
  varName: string;
  /** Raw (unconverted) LaTeX for the lower bound. */
  lowerLatex: string;
  /** Raw (unconverted) LaTeX for the upper bound. */
  upperLatex: string;
}

export interface ParsedIntegral {
  mode: IntegralMode;
  /** Outer-to-inner order: levels[0] is the outermost integral sign. */
  levels: IntegralLevel[];
  /** Raw (unconverted) LaTeX for the integrand. */
  integrandLatex: string;
}

export type ParseResult = { ok: true; integral: ParsedIntegral } | { ok: false; error: string };

const VALID_VARS = new Set(["x", "y", "z"]);

interface Cursor {
  s: string;
  i: number;
}

/** Reads one `_{...}` / `^{...}` bound, or a bare single-token bound (a
 * signed number, a backslash command like \pi, or a single character). */
function readBound(c: Cursor): string {
  if (c.s[c.i] === "{") {
    let depth = 1;
    let j = c.i + 1;
    while (j < c.s.length && depth > 0) {
      if (c.s[j] === "{") depth++;
      else if (c.s[j] === "}") depth--;
      j++;
    }
    const inner = c.s.slice(c.i + 1, j - 1);
    c.i = j;
    return inner;
  }
  if (c.s[c.i] === "\\") {
    let j = c.i + 1;
    while (j < c.s.length && /[a-zA-Z]/.test(c.s[j])) j++;
    const atom = c.s.slice(c.i, j);
    c.i = j;
    return atom;
  }
  let j = c.i;
  if (c.s[j] === "-" || c.s[j] === "+") j++;
  if (/[0-9]/.test(c.s[j] ?? "")) {
    while (/[0-9.]/.test(c.s[j] ?? "")) j++;
  } else {
    j++;
  }
  const atom = c.s.slice(c.i, j);
  c.i = j;
  return atom;
}

export function parseIntegral(latexRaw: string): ParseResult {
  const s = stripLatexNoise(latexRaw);
  const c: Cursor = { s, i: 0 };

  const levels: IntegralLevel[] = [];
  while (c.s.startsWith("\\int", c.i)) {
    c.i += 4;
    let lowerLatex: string | null = null;
    let upperLatex: string | null = null;
    while (c.s[c.i] === "_" || c.s[c.i] === "^") {
      const isLower = c.s[c.i] === "_";
      c.i++;
      if (c.i >= c.s.length) {
        return { ok: false, error: "Integral bound is missing after _ or ^." };
      }
      const bound = readBound(c);
      if (isLower) lowerLatex = bound;
      else upperLatex = bound;
    }
    if (lowerLatex === null || upperLatex === null) {
      return {
        ok: false,
        error: `Integral ${levels.length + 1} is missing its ${lowerLatex === null ? "lower" : "upper"} bound (expected \\int_{...}^{...}).`,
      };
    }
    levels.push({ varName: "", lowerLatex, upperLatex });
  }

  if (levels.length !== 2 && levels.length !== 3) {
    return {
      ok: false,
      error: `Expected a double (2) or triple (3) integral, found ${levels.length} \\int sign${levels.length === 1 ? "" : "s"}.`,
    };
  }

  let remaining = c.s.slice(c.i);
  const diffVars: string[] = [];
  for (let k = 0; k < levels.length; k++) {
    if (remaining.length < 2 || remaining[remaining.length - 2] !== "d") {
      return {
        ok: false,
        error: `Expected ${levels.length} differentials (e.g. ${levels.length === 2 ? "dy dx" : "dz dy dx"}), only found ${k}.`,
      };
    }
    const varLetter = remaining[remaining.length - 1];
    if (!VALID_VARS.has(varLetter)) {
      return { ok: false, error: `Differential variable "${varLetter}" must be x, y, or z.` };
    }
    diffVars.push(varLetter);
    remaining = remaining.slice(0, remaining.length - 2);
  }

  if (new Set(diffVars).size !== diffVars.length) {
    return { ok: false, error: `Each variable must appear in exactly one differential (got: ${diffVars.join(", ")}).` };
  }

  const integrandLatex = remaining;
  if (integrandLatex.length === 0) {
    return { ok: false, error: "Integral is missing its integrand (the function to integrate)." };
  }

  levels.forEach((level, idx) => {
    level.varName = diffVars[idx];
  });

  return {
    ok: true,
    integral: {
      mode: levels.length === 2 ? "double" : "triple",
      levels,
      integrandLatex,
    },
  };
}

/**
 * Rebuilds a full integral LaTeX string from its parsed pieces -- the
 * inverse of parseIntegral. Used by the bounds editor to turn an edit to
 * one field (a single bound, or the integrand) back into a complete LaTeX
 * string. Bounds are always braced in the output, regardless of whether
 * the original used bare/unbraced bounds.
 */
export function buildIntegralLatex(levels: IntegralLevel[], integrandLatex: string): string {
  const integralSigns = levels.map((l) => `\\int_{${l.lowerLatex}}^{${l.upperLatex}}`).join("");
  const differentials = [...levels]
    .reverse()
    .map((l) => `d${l.varName}`)
    .join("\\, ");
  return `${integralSigns} ${integrandLatex} \\, ${differentials}`;
}
