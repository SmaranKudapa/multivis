import { useMemo } from "react";
import { buildIntegralLatex, parseIntegral, type IntegralLevel } from "../lib/latex/parseIntegral";

interface BoundsEditorProps {
  latex: string;
  onChange: (latex: string) => void;
}

/**
 * A structured alternative to editing the raw LaTeX by hand: one row per
 * bound plus the integrand, each a plain text field. Editing a field
 * rebuilds the full LaTeX string (via buildIntegralLatex) and reports it
 * through onChange, so the LaTeX box stays the single source of truth --
 * this is a view onto the same state, not a separate one to keep in sync.
 * Renders nothing if the current LaTeX doesn't parse as an integral yet
 * (the user needs to fix the structure in the box first).
 */
export function BoundsEditor({ latex, onChange }: BoundsEditorProps) {
  const parsed = useMemo(() => parseIntegral(latex), [latex]);

  if (!parsed.ok) return null;
  const { levels, integrandLatex } = parsed.integral;

  function updateLevel(index: number, patch: Partial<IntegralLevel>) {
    if (!parsed.ok) return;
    const nextLevels = parsed.integral.levels.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onChange(buildIntegralLatex(nextLevels, parsed.integral.integrandLatex));
  }

  function updateIntegrand(next: string) {
    if (!parsed.ok) return;
    onChange(buildIntegralLatex(parsed.integral.levels, next));
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
