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

const SAMPLE_DOUBLE_LATEX = "\\int_{-1}^{1}\\int_{-\\sqrt{1-x^2}}^{\\sqrt{1-x^2}} x^2+y^2 \\, dy\\, dx";
const SAMPLE_TRIPLE_LATEX = "\\int_{0}^{1}\\int_{0}^{1-x}\\int_{0}^{1-x-y} 1 \\, dz\\, dy\\, dx";

function App() {
  const [latex, setLatex] = useState(SAMPLE_DOUBLE_LATEX);
  const evaluated = useParsedIntegral(latex);
  const isDouble = evaluated.status === "ok" && evaluated.mode === "double";
  const isTriple = evaluated.status === "ok" && evaluated.mode === "triple";

  return (
    <main className="app-shell">
      <h1>Multivis</h1>
      <LatexInput value={latex} onChange={setLatex} />
      <div className="samples">
        <button type="button" onClick={() => setLatex(SAMPLE_DOUBLE_LATEX)}>
          Sample 2D integral
        </button>
        <button type="button" onClick={() => setLatex(SAMPLE_TRIPLE_LATEX)}>
          Sample 3D integral
        </button>
      </div>
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
