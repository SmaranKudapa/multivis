import { useState } from "react";
import "./App.css";
import { LatexInput } from "./components/LatexInput";
import { RenderedFormula } from "./components/RenderedFormula";
import { ResultPanel } from "./components/ResultPanel";
import { BoundsVisual2D } from "./components/BoundsVisual2D";
import { SceneRoot } from "./components/scene/SceneRoot";
import { DoubleIntegralVisual } from "./components/scene/DoubleIntegralVisual";
import { TripleIntegralVisual } from "./components/scene/TripleIntegralVisual";
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
          {/* For a double integral this is the 2D base region D. A triple
              integral's bounds describe a 3D solid directly (there's no
              separate 2D region to show), so this panel shows that solid
              instead -- and Shape Vis, which for a double integral shows
              "volume under a surface," doesn't have an equivalent for a
              triple integral (there's no surface), so it's disabled. */}
          <div className={`graph-container${isDouble ? " graph-container--2d" : ""}`}>
            {isDouble && evaluated.status === "ok" && <BoundsVisual2D levels={evaluated.levels} />}
            {isTriple && evaluated.status === "ok" && (
              <SceneRoot>
                <TripleIntegralVisual levels={evaluated.levels} />
              </SceneRoot>
            )}
            {evaluated.status === "error" && <p className="graph-placeholder graph-placeholder--error">Fix the integral above to see this graph.</p>}
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
            {isTriple && <p className="graph-placeholder">Shape Vis disabled.</p>}
            {evaluated.status === "error" && <p className="graph-placeholder graph-placeholder--error">Fix the integral above to see this graph.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
