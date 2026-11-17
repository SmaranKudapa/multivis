import { useMemo } from "react";
import { convertLatexToMarkup } from "mathlive";
import "mathlive/static.css";
import type { Analysis } from "../lib/math/analyze";
import type { Problem } from "../lib/math/problem";
import { formatResult } from "../lib/math/format";

interface ResultPanelProps {
  analysis: Analysis;
  notes: string[];
}

function LatexSnippet({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return convertLatexToMarkup(latex);
    } catch {
      return null;
    }
  }, [latex]);
  if (!html) return <code>{latex}</code>;
  // MathLive-generated markup from the user's own formula, not arbitrary HTML.
  return <span className="latex-snippet" dangerouslySetInnerHTML={{ __html: html }} />;
}

function ProblemCard({ problem, tone }: { problem: Problem; tone: "error" | "warning" }) {
  return (
    <div className={`problem problem--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p className="problem-title">{problem.title}</p>
      {problem.part && problem.part !== "integral" && (
        <p className="problem-part">
          Problem in the <strong>{problem.part}</strong>
          {problem.partLatex && !/^\\placeholder(\[[^\]]*\])?\{\s*\}$/.test(problem.partLatex) ? (
            <>
              : <LatexSnippet latex={problem.partLatex} />
            </>
          ) : null}
        </p>
      )}
      <p className="problem-message">{problem.message}</p>
    </div>
  );
}

export function ResultPanel({ analysis, notes }: ResultPanelProps) {
  if (analysis.status === "error") {
    return (
      <section className="result-panel" aria-live="polite">
        <ProblemCard problem={analysis.problem} tone="error" />
      </section>
    );
  }

  const { integral, value, warnings } = analysis;
  const { system } = integral;
  const showJacobianNote = system.jacobianNote && !warnings.some((w) => w.startsWith(system.jacobianNote!));

  return (
    <section className="result-panel" aria-live="polite">
      <div className="result-value">
        <span className="result-label">{system.label}</span>
        <span className="result-number">
          ≈ <strong>{formatResult(value)}</strong>
        </span>
      </div>
      {analysis.status === "ungraphable" && analysis.problem && <ProblemCard problem={analysis.problem} tone="warning" />}
      {warnings.map((w) => (
        <p key={w} className="note note--warning">
          {w}
        </p>
      ))}
      {showJacobianNote && <p className="note">{system.jacobianNote}</p>}
      {notes.map((n) => (
        <p key={n} className="note">
          {n}
        </p>
      ))}
    </section>
  );
}
