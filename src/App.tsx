import { useState } from "react";
import "./App.css";
import { LatexInput } from "./components/LatexInput";
import { RenderedFormula } from "./components/RenderedFormula";
import { ResultPanel } from "./components/ResultPanel";
import { BoundsVisual2D } from "./components/BoundsVisual2D";
import { SceneRoot } from "./components/scene/SceneRoot";
import { DoubleIntegralVisual } from "./components/scene/DoubleIntegralVisual";
import { useParsedIntegral } from "./hooks/useParsedIntegral";

const DEFAULT_LATEX = "\\int_{-1}^{1}\\int_{-\\sqrt{1-x^2}}^{\\sqrt{1-x^2}} x^2+y^2 \\, dy\\, dx";

function App() {
  const [latex, setLatex] = useState(DEFAULT_LATEX);
  const evaluated = useParsedIntegral(latex);
  const isDouble = evaluated.status === "ok" && evaluated.mode === "double";
  const isTriple = evaluated.status === "ok" && evaluated.mode === "triple";

  return (
    <main className="app-shell">
      <h1>Multivis</h1>
      <LatexInput value={latex} onChange={setLatex} />
      <RenderedFormula latex={latex} />
      <ResultPanel evaluated={evaluated} />

      <div className="graphs">
        <div className="graph-panel">
          <h2 className="graph-label">Bounds Vis</h2>
          <div className="graph-container graph-container--2d">
            {isDouble && evaluated.status === "ok" && <BoundsVisual2D levels={evaluated.levels} />}
            {isTriple && <p className="graph-placeholder">Coming soon for triple integrals.</p>}
          </div>
        </div>

        <div className="graph-panel">
          <h2 className="graph-label">Shape Vis</h2>
          <div className="graph-container">
            {isDouble && evaluated.status === "ok" && (
              <SceneRoot>
                <DoubleIntegralVisual levels={evaluated.levels} integrandFn={evaluated.integrandFn} />
              </SceneRoot>
            )}
            {isTriple && <p className="graph-placeholder">Coming soon for triple integrals.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
