import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface RenderedFormulaProps {
  latex: string;
}

export function RenderedFormula({ latex }: RenderedFormulaProps) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        errorColor: "#c00",
        displayMode: true,
      }),
    [latex],
  );

  // eslint-disable-next-line react/no-danger -- KaTeX-generated markup, not user HTML.
  return <div className="rendered-formula" dangerouslySetInnerHTML={{ __html: html }} />;
}
