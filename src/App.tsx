import { useDeferredValue, useMemo, useRef, useState } from "react";
import "./App.css";
import { MathEditor, type MathEditorHandle } from "./components/MathEditor";
import { ResultPanel } from "./components/ResultPanel";
import { GraphArea } from "./components/GraphArea";
import { analyzeIntegral } from "./lib/math/analyze";
import { clipNotes, computeClips } from "./lib/graph/region";
import { EXAMPLES, TEMPLATES } from "./presets";

const INITIAL = EXAMPLES[1].latex;

function App() {
  const [latex, setLatex] = useState(INITIAL);
  const [showLatex, setShowLatex] = useState(false);
  const editorRef = useRef<MathEditorHandle>(null);

  // Typing stays responsive even while a heavy triple integral is recomputed.
  const deferredLatex = useDeferredValue(latex);
  const analysis = useMemo(() => analyzeIntegral(deferredLatex), [deferredLatex]);
  const clips = useMemo(() => (analysis.status === "error" ? null : computeClips(analysis.ranges)), [analysis]);
  const notes = useMemo(
    () => (analysis.status === "ok" && clips ? clipNotes(analysis.integral, clips) : []),
    [analysis, clips],
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Multivis</h1>
        <p className="tagline">Type an integral, get its value and see its region.</p>
      </header>

      <section className="editor-card">
        <div className="template-bar" role="toolbar" aria-label="Integral templates">
          <span className="toolbar-label">New:</span>
          {TEMPLATES.map((t) => (
            <button key={t.label} type="button" className="template-button" onClick={() => editorRef.current?.insertTemplate(t.latex)}>
              <span className="template-name">{t.label}</span>
              <span className="template-symbol">{t.symbol}</span>
            </button>
          ))}
        </div>

        <MathEditor ref={editorRef} value={latex} onChange={setLatex} />

        <p className="editor-help">
          Click a box to edit it, and press <kbd>Tab</kbd> to jump to the next empty box. Shortcuts: <code>int</code> → ∫, <code>/</code> → fraction,{" "}
          <code>^</code> → power, <code>sqrt</code> → √, <code>pi</code> → π, <code>theta</code>/<code>rho</code>/<code>phi</code> → θ/ρ/φ,{" "}
          <code>oo</code> → ∞.
        </p>

        <div className="editor-footer">
          <label className="examples">
            <span>Examples:</span>
            <select
              value=""
              onChange={(e) => {
                const ex = EXAMPLES[Number(e.target.value)];
                if (ex) setLatex(ex.latex);
              }}
            >
              <option value="" disabled>
                Choose an example…
              </option>
              {EXAMPLES.map((ex, i) => (
                <option key={ex.label} value={i}>
                  {ex.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="link-button" onClick={() => setShowLatex((s) => !s)} aria-expanded={showLatex}>
            {showLatex ? "Hide LaTeX" : "Show LaTeX"}
          </button>
        </div>

        {showLatex && (
          <textarea
            className="latex-input"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            spellCheck={false}
            aria-label="Integral as LaTeX"
          />
        )}
      </section>

      <ResultPanel analysis={analysis} notes={notes} />
      <GraphArea analysis={analysis} clips={clips} />
    </main>
  );
}

export default App;
