import { useEffect, useState } from "react";
import { buildIntegralLatex, parseIntegral, type IntegralLevel } from "../lib/latex/parseIntegral";

interface BoundsEditorProps {
  latex: string;
  onChange: (latex: string) => void;
}

interface Structure {
  levels: IntegralLevel[];
  integrandLatex: string;
}

function parseToStructure(latex: string): Structure | null {
  const parsed = parseIntegral(latex);
  return parsed.ok ? { levels: parsed.integral.levels, integrandLatex: parsed.integral.integrandLatex } : null;
}

/**
 * A structured alternative to editing the raw LaTeX by hand: one row per
 * bound plus the integrand, each a plain text field. Editing a field
 * rebuilds the full LaTeX string (via buildIntegralLatex) and reports it
 * through onChange, so the LaTeX box stays the single source of truth.
 *
 * Keeps its own copy of the last successfully-parsed structure rather than
 * re-deriving purely from `latex` on every render: a field can legitimately
 * pass through a not-yet-valid state while being edited (e.g. the integrand
 * briefly empty), and re-parsing would otherwise make the whole editor
 * vanish mid-edit instead of just letting the resulting error show
 * elsewhere (the result panel, the graphs) while editing continues here.
 */
export function BoundsEditor({ latex, onChange }: BoundsEditorProps) {
  const [structure, setStructure] = useState<Structure | null>(() => parseToStructure(latex));

  useEffect(() => {
    const next = parseToStructure(latex);
    if (next) setStructure(next);
  }, [latex]);

  if (!structure) return null;
  const { levels, integrandLatex } = structure;

  function updateLevel(index: number, patch: Partial<IntegralLevel>) {
    const nextLevels = levels.map((l, i) => (i === index ? { ...l, ...patch } : l));
    setStructure({ levels: nextLevels, integrandLatex });
    onChange(buildIntegralLatex(nextLevels, integrandLatex));
  }

  function updateIntegrand(next: string) {
    setStructure({ levels, integrandLatex: next });
    onChange(buildIntegralLatex(levels, next));
  }

  return (
    <div className="bounds-editor">
      {levels.map((level, i) => (
        <div className="bounds-editor-row" key={level.varName}>
          <span className="bounds-editor-label">{level.varName}:</span>
          <input
            className="bounds-editor-input"
            value={level.lowerLatex}
            onChange={(e) => updateLevel(i, { lowerLatex: e.target.value })}
            aria-label={`Lower bound of ${level.varName}`}
          />
          <span className="bounds-editor-to">to</span>
          <input
            className="bounds-editor-input"
            value={level.upperLatex}
            onChange={(e) => updateLevel(i, { upperLatex: e.target.value })}
            aria-label={`Upper bound of ${level.varName}`}
          />
        </div>
      ))}
      <div className="bounds-editor-row">
        <span className="bounds-editor-label">f =</span>
        <input
          className="bounds-editor-input bounds-editor-input--wide"
          value={integrandLatex}
          onChange={(e) => updateIntegrand(e.target.value)}
          aria-label="Integrand"
        />
      </div>
    </div>
  );
}
