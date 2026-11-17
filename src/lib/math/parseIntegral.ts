import { tokenize, describeToken, type Token } from "./tokenize";
import { parseExpression, ExpressionError, type Node } from "./expression";
import { detectSystem, displayVar, type CoordSystem } from "./coords";
import { capitalize, partName, type Problem } from "./problem";

export interface ParsedLevel {
  /** Canonical variable name ("x", "theta", ...). */
  varName: string;
  lower: Node;
  upper: Node;
  lowerLatex: string;
  upperLatex: string;
}

export interface ParsedIntegral {
  system: CoordSystem;
  /** Outer-to-inner: levels[0] is the leftmost ∫ (and pairs with the rightmost differential). */
  levels: ParsedLevel[];
  integrand: Node;
  integrandLatex: string;
  /** True when nothing was written between the integral signs and the differentials (integrand = 1). */
  integrandImplicit: boolean;
}

export type ParseIntegralResult = { ok: true; integral: ParsedIntegral } | { ok: false; problem: Problem };

const VAR_LETTERS = new Set(["x", "y", "z", "r"]);
const VAR_COMMANDS: Record<string, string> = { theta: "theta", rho: "rho", phi: "phi" };

function structureProblem(message: string, title = "This isn't a complete integral yet"): ParseIntegralResult {
  return { ok: false, problem: { title, message, part: partName("structure") } };
}

function isIntegralSign(tok: Token | undefined): boolean {
  return tok !== undefined && tok.kind === "cmd" && (tok.value === "int" || tok.value === "iint" || tok.value === "iiint");
}

function isSym(tok: Token | undefined, value: string): boolean {
  return tok !== undefined && tok.kind === "sym" && tok.value === value;
}

/** Tokens of one `_{...}` / `^{...}` argument: a braced group, or (as in LaTeX) a single token. */
function readScript(tokens: Token[], i: number): { group: Token[]; next: number; braced: boolean } {
  const tok = tokens[i];
  if (isSym(tok, "{")) {
    let depth = 0;
    for (let j = i; j < tokens.length; j++) {
      if (isSym(tokens[j], "{")) depth++;
      else if (isSym(tokens[j], "}")) {
        depth--;
        if (depth === 0) return { group: tokens.slice(i + 1, j), next: j + 1, braced: true };
      }
    }
    return { group: tokens.slice(i + 1), next: tokens.length, braced: true };
  }
  if (tok.kind === "num" && tok.value.length > 1) {
    // LaTeX semantics: \int_0^10 is \int_0^{1} 0.
    const first: Token = { ...tok, value: tok.value[0], end: tok.start + 1 };
    tokens[i] = { ...tok, value: tok.value.slice(1), start: tok.start + 1 };
    return { group: [first], next: i, braced: false };
  }
  return { group: [tok], next: i + 1, braced: false };
}

function differentialVar(tok: Token | undefined): string | null {
  if (!tok) return null;
  if (tok.kind === "letter" && VAR_LETTERS.has(tok.value)) return tok.value;
  if (tok.kind === "cmd" && tok.value in VAR_COMMANDS) return VAR_COMMANDS[tok.value];
  return null;
}

function isDifferentialMarker(tok: Token | undefined): boolean {
  return tok !== undefined && (tok.kind === "d" || (tok.kind === "letter" && tok.value === "d"));
}

function sliceLatex(src: string, toks: Token[]): string {
  if (toks.length === 0) return "";
  return src.slice(toks[0].start, toks[toks.length - 1].end).trim();
}

/**
 * Splits an integral written in LaTeX into its bounds, integrand and
 * differentials, works out the coordinate system, and parses every piece
 * into an AST. Any problem comes back with the part it's in.
 */
export function parseIntegral(latex: string): ParseIntegralResult {
  const tokens = tokenize(latex);
  if (tokens.length === 0) {
    return structureProblem("Type an integral, or start from one of the templates above.", "Nothing to show yet");
  }

  // 1. Integral signs and their bounds.
  if (!isIntegralSign(tokens[0])) {
    return structureProblem("An integral has to start with an integral sign ∫. Try one of the templates above.");
  }

  interface RawLevel {
    lowerToks: Token[] | null;
    upperToks: Token[] | null;
    lowerBraced: boolean;
    upperBraced: boolean;
  }
  const raw: RawLevel[] = [];
  let i = 0;
  while (isIntegralSign(tokens[i])) {
    const sign = tokens[i];
    if (sign.value !== "int") {
      return structureProblem(
        `Use one ∫ sign per variable, each with its own bounds — for example \\int_0^1\\int_0^1 … dy\\,dx instead of ${sign.value === "iint" ? "∬" : "∭"}.`,
        "Multiple-integral sign not supported",
      );
    }
    i++;
    const level: RawLevel = { lowerToks: null, upperToks: null, lowerBraced: false, upperBraced: false };
    while (isSym(tokens[i], "_") || isSym(tokens[i], "^")) {
      const isLower = tokens[i].value === "_";
      i++;
      if (i >= tokens.length) return structureProblem("A bound is missing after “_” or “^”.");
      const { group, next, braced } = readScript(tokens, i);
      i = next;
      if (isLower) {
        level.lowerToks = group;
        level.lowerBraced = braced;
      } else {
        level.upperToks = group;
        level.upperBraced = braced;
      }
    }
    raw.push(level);
  }

  const n = raw.length;
  if (n > 3) {
    return structureProblem(`Found ${n} integral signs. Multivis handles single, double and triple integrals.`, "Too many integral signs");
  }

  // 2. Differentials, read from the end: "… dz dy dx".
  let end = tokens.length;
  const diffVars: string[] = [];
  while (end - 2 >= i && isDifferentialMarker(tokens[end - 2])) {
    const v = differentialVar(tokens[end - 1]);
    if (v === null) {
      const bad = tokens[end - 1];
      return structureProblem(
        `“d${describeToken(bad)}” isn't a differential Multivis understands. Use dx, dy, dz, dr, dθ, dρ or dφ.`,
        "Unknown differential",
      );
    }
    diffVars.unshift(v);
    end -= 2;
  }

  const diffList = diffVars.map((v) => "d" + displayVar(v)).join(" ");
  if (diffVars.length === 0) {
    const example = n === 1 ? "dx" : n === 2 ? "dy dx" : "dz dy dx";
    return structureProblem(
      `End the integral with ${n === 1 ? "a differential" : `${n} differentials`} saying what you're integrating with respect to, like ${example}.`,
      "Missing differentials",
    );
  }
  if (diffVars.length !== n) {
    return structureProblem(
      `There ${n === 1 ? "is 1 integral sign" : `are ${n} integral signs`} but ${diffVars.length} differential${diffVars.length === 1 ? "" : "s"} (${diffList}). Each ∫ needs exactly one matching differential.`,
      "Integral signs and differentials don't match",
    );
  }
  const dupe = diffVars.find((v, idx) => diffVars.indexOf(v) !== idx);
  if (dupe) {
    return structureProblem(`d${displayVar(dupe)} appears more than once (${diffList}). Each variable can only be integrated once.`, "Repeated differential");
  }

  const detected = detectSystem(diffVars);
  if (!detected.ok) return structureProblem(detected.message, "Unsupported combination of variables");

  // 3. Integrand: everything between the bounds and the differentials.
  const integrandToks = tokens.slice(i, end);
  const stray = integrandToks.find((t) => isIntegralSign(t));
  if (stray) {
    return structureProblem("All the integral signs have to come first, before the integrand.", "Integral sign in the middle");
  }

  // Innermost ∫ pairs with the first (leftmost) differential.
  const levels: ParsedLevel[] = [];
  for (let k = 0; k < n; k++) {
    const varName = diffVars[n - 1 - k];
    const shown = displayVar(varName);
    const r = raw[k];
    if (r.lowerToks === null && r.upperToks === null) {
      return {
        ok: false,
        problem: {
          title: `The ${shown} integral has no bounds`,
          message: `Multivis needs definite integrals. Give the ∫ for ${shown} a lower bound (below, with _) and an upper bound (above, with ^).`,
          part: `bounds of ${shown}`,
        },
      };
    }
    for (const kind of ["lower", "upper"] as const) {
      const toks = kind === "lower" ? r.lowerToks : r.upperToks;
      if (toks === null || toks.length === 0) {
        return {
          ok: false,
          problem: {
            title: `Missing ${partName(kind, shown)}`,
            message: `The ∫ for ${shown} needs ${kind === "lower" ? "a lower bound (written with _)" : "an upper bound (written with ^)"}.`,
            part: partName(kind, shown),
          },
        };
      }
    }
    const lowerResult = parsePart(latex, r.lowerToks!, partName("lower", shown));
    if (!lowerResult.ok) return lowerResult;
    const upperResult = parsePart(latex, r.upperToks!, partName("upper", shown));
    if (!upperResult.ok) return upperResult;
    levels.push({
      varName,
      lower: lowerResult.node,
      upper: upperResult.node,
      lowerLatex: sliceLatex(latex, r.lowerToks!),
      upperLatex: sliceLatex(latex, r.upperToks!),
    });
  }

  let integrand: Node = { k: "num", v: 1 };
  const integrandImplicit = integrandToks.length === 0;
  if (!integrandImplicit) {
    const res = parsePart(latex, integrandToks, partName("integrand"));
    if (!res.ok) return res;
    integrand = res.node;
  }

  return {
    ok: true,
    integral: {
      system: detected.system,
      levels,
      integrand,
      integrandLatex: integrandImplicit ? "1" : sliceLatex(latex, integrandToks),
      integrandImplicit,
    },
  };
}

function parsePart(
  latex: string,
  toks: Token[],
  part: string,
): { ok: true; node: Node } | { ok: false; problem: Problem } {
  try {
    return { ok: true, node: parseExpression(toks) };
  } catch (err) {
    if (!(err instanceof ExpressionError)) throw err;
    const isEmptyBox = err.token?.kind === "placeholder";
    return {
      ok: false,
      problem: {
        title: isEmptyBox ? `Fill in the ${part}` : part === "integrand" ? "The integrand isn't valid" : `${capitalize(part)} isn't valid`,
        message: err.message,
        part,
        partLatex: sliceLatex(latex, toks),
      },
    };
  }
}
