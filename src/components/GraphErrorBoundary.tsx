import { Component, type ReactNode } from "react";

interface Props {
  /** Changing this (e.g. the LaTeX) clears a previous failure. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  failedKey: string | null;
}

/** Keeps a rendering failure in one graph from blanking the whole page. */
export class GraphErrorBoundary extends Component<Props, State> {
  state: State = { failedKey: null };

  static getDerivedStateFromError(): Partial<State> {
    return { failedKey: "__pending__" };
  }

  componentDidCatch(error: unknown) {
    console.error("Graph failed to render:", error);
    this.setState({ failedKey: this.props.resetKey });
  }

  render() {
    const { failedKey } = this.state;
    if (failedKey !== null && (failedKey === "__pending__" || failedKey === this.props.resetKey)) {
      return <p className="graph-placeholder graph-placeholder--fill">This graph couldn't be drawn for this integral.</p>;
    }
    return this.props.children;
  }
}
