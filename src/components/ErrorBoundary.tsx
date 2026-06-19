import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { EmptyState } from "./EmptyState";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Solar Earth Watch UI failure", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <EmptyState
            title="unavailable witness"
            detail="The downstream dashboard surface failed to render."
          />
        </main>
      );
    }

    return this.props.children;
  }
}
