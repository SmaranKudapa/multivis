import { useState } from "react";
import "./App.css";
import { LatexInput } from "./components/LatexInput";
import { RenderedFormula } from "./components/RenderedFormula";
import { ResultPanel } from "./components/ResultPanel";
import { useParsedIntegral } from "./hooks/useParsedIntegral";

const DEFAULT_LATEX = "\\int_{0}^{1}\\int_{x^2}^{\\sqrt{x}} 1 \\, dy\\, dx";

function App() {
  const [latex, setLatex] = useState(DEFAULT_LATEX);
  const evaluated = useParsedIntegral(latex);

  return (
    <main className="app-shell">
      <h1>Multivis</h1>
      <LatexInput value={latex} onChange={setLatex} />
      <RenderedFormula latex={latex} />
      <ResultPanel evaluated={evaluated} />
    </main>
  );
}

export default App;
