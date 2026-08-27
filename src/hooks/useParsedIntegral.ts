import { useMemo } from "react";
import { evaluateLatexIntegral, type EvaluatedIntegral } from "../lib/evaluateIntegral";

/** Memoized LaTeX -> parsed bounds -> compiled functions -> computed integral pipeline. */
export function useParsedIntegral(latex: string, resolutions?: number[]): EvaluatedIntegral {
  return useMemo(() => evaluateLatexIntegral(latex, resolutions), [latex, resolutions]);
}
