import type { ReactNode } from "react";
import type { Analysis } from "../lib/math/analyze";
import type { ViewClip } from "../lib/graph/region";
import { CurvePlot } from "./graphs/CurvePlot";
import { RegionPlot } from "./graphs/RegionPlot";
import { SurfaceScene } from "./scene/SurfaceScene";
import { SolidScene } from "./scene/SolidScene";
import { GraphErrorBoundary } from "./GraphErrorBoundary";

interface GraphAreaProps {
  analysis: Analysis;
  clips: ViewClip[] | null;
}

function Panel({ title, caption, resetKey, children }: { title: string; caption: string; resetKey: string; children: ReactNode }) {
  return (
    <figure className="graph-panel">
      <figcaption>
        <span className="graph-title">{title}</span>
        <span className="graph-caption">{caption}</span>
      </figcaption>
      <div className="graph-container">
        <GraphErrorBoundary resetKey={resetKey}>{children}</GraphErrorBoundary>
      </div>
    </figure>
  );
}

/** Picks the right graphs for the integral; shows nothing when it's invalid or can't be graphed. */
export function GraphArea({ analysis, clips }: GraphAreaProps) {
  if (analysis.status !== "ok" || !clips) {
    return (
      <div className="graphs graphs--empty">
        <p className="graph-placeholder">
          {analysis.status === "ungraphable"
            ? "No graph: the bounds don't describe a real region (see above)."
            : "Graphs appear here once the integral is valid."}
        </p>
      </div>
    );
  }

  const { integral } = analysis;
  const dim = integral.system.dimension;
  const key = integral.levels.map((l) => `${l.varName}:${l.lowerLatex}:${l.upperLatex}`).join("|") + "|" + integral.integrandLatex;

  if (dim === 1) {
    return (
      <div className="graphs graphs--single">
        <Panel resetKey={key} title="Area under the curve" caption="Shaded area is the integral (below the axis counts negative).">
          <CurvePlot integral={integral} clips={clips} />
        </Panel>
      </div>
    );
  }

  if (dim === 2) {
    return (
      <div className="graphs">
        <Panel resetKey={key} title="Region" caption="The region of integration. Faint lines show the inner integral's slices.">
          <RegionPlot integral={integral} clips={clips} />
        </Panel>
        <Panel
          resetKey={key}
          title="Volume"
          caption={`Surface height = ${integral.system.kind === "polar" ? "integrand ÷ r (the height over the xy-plane)" : "integrand"}, so the volume under it is the integral. Drag to rotate, scroll to zoom.`}
        >
          <SurfaceScene integral={integral} clips={clips} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="graphs graphs--single">
      <Panel
        resetKey={key}
        title="Solid"
        caption={
          "The solid region of integration. If the integrand is a varying density, the color shows it. Drag to rotate, scroll to zoom."
        }
      >
        <SolidScene integral={integral} clips={clips} />
      </Panel>
    </div>
  );
}
