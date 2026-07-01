// Phase 1 UI (T4): a minimal render-time safety net. If a child throws while
// rendering (e.g. Recharts fed malformed data), show the fallback instead of
// letting React unmount the whole app - the third failure mode, beyond tool and
// LLM-channel errors (both handled in loop.ts). A component cannot catch its own
// render throw, so this parent boundary is the guard. Retry / finer isolation
// are Phase 2. Must be a class - error boundaries have no hook equivalent.

import { Component } from "react";
import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
