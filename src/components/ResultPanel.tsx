import type { EvaluatedIntegral } from "../lib/evaluateIntegral";

interface ResultPanelProps {
  evaluated: EvaluatedIntegral;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded.toString();
}

export function ResultPanel({ evaluated }: ResultPanelProps) {
  if (evaluated.status === "error") {
    return (
      <div className="result-panel result-panel--error" role="alert">
        {evaluated.error}
      </div>
    );
  }

  const kind = evaluated.mode === "double" ? "Area/volume" : "Volume/mass";
  return (
    <div className="result-panel">
      {kind} &asymp; <strong>{formatValue(evaluated.result.total)}</strong>
    </div>
  );
}
