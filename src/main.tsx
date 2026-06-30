import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found in index.html'); // throws before React mounts if VITE_CONVEX_URL missing / not valid absolute URL

createRoot(rootEl).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
