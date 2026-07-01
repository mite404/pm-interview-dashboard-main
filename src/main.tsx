import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// No ConvexProvider: the app talks to Convex through a ConvexHttpClient inside
// the tool-calling loop (one-shot queries), not via React hooks.
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found in index.html');

// Nested boundaries: this top-level one is the last-resort catch-all (any
// unforeseen render crash -> a reload screen, never a blank page). The chart
// has its own inner boundary for finer-grained, keep-working degradation.
const appFallback = (
  <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
    Something went wrong. Please reload the page.
  </div>
);

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary fallback={appFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
