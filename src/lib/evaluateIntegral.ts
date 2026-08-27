import { parseIntegral, type IntegralMode } from "./latex/parseIntegral";
import { latexToMathJs } from "./latex/latexToMathJs";
import { compileExpression, type ScalarFn } from "./parser";
import { computeIntegral, type IntegralResult } from "./integration";

export interface EvaluatedLevel {
  varName: string;
  lowerFn: ScalarFn;
  upperFn: ScalarFn;
}

export type EvaluatedIntegral =
  | { status: "error"; error: string }
  | {
      status: "ok";
      mode: IntegralMode;
      levels: EvaluatedLevel[];
      integrandFn: ScalarFn;
      result: IntegralResult;
    };

function defaultResolutions(mode: IntegralMode): number[] {
  return mode === "double" ? [28, 28] : [14, 14, 14];
}

/**
 * Runs the full pipeline: raw LaTeX -> parsed bounds/integrand -> compiled
 * functions -> computed Riemann sum. Pulled out of the React hook so it can
 * be unit-tested directly, with no rendering involved.
 */
export function evaluateLatexIntegral(latex: string, resolutions?: number[]): EvaluatedIntegral {
  const parsed = parseIntegral(latex);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }
  const { mode, levels, integrandLatex } = parsed.integral;
  const allVarNames = levels.map((l) => l.varName);

  const evaluatedLevels: EvaluatedLevel[] = [];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const outerVars = allVarNames.slice(0, i);

    const lowerCompiled = compileExpression(latexToMathJs(level.lowerLatex), outerVars);
    if (lowerCompiled.error) {
      return { status: "error", error: `Lower bound of ${level.varName}: ${lowerCompiled.error}` };
    }
    const upperCompiled = compileExpression(latexToMathJs(level.upperLatex), outerVars);
    if (upperCompiled.error) {
      return { status: "error", error: `Upper bound of ${level.varName}: ${upperCompiled.error}` };
    }

    evaluatedLevels.push({ varName: level.varName, lowerFn: lowerCompiled.fn, upperFn: upperCompiled.fn });
  }

  const integrandCompiled = compileExpression(latexToMathJs(integrandLatex), allVarNames);
  if (integrandCompiled.error) {
    return { status: "error", error: `Integrand: ${integrandCompiled.error}` };
  }

  const result = computeIntegral(
    integrandCompiled.fn,
    evaluatedLevels.map((l) => ({ varName: l.varName, lower: l.lowerFn, upper: l.upperFn })),
    resolutions ?? defaultResolutions(mode),
  );

  return { status: "ok", mode, levels: evaluatedLevels, integrandFn: integrandCompiled.fn, result };
}
