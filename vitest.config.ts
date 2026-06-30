import { defineConfig } from "vitest/config";

// Vitest reads this in preference to vite.config.ts. We deliberately omit the
// React/Babel plugin: the Phase 1 unit layer is pure calculations (no JSX, no
// DOM), so a plain `node` environment is faster and keeps the output clean.
// The React plugin + a jsdom environment are added in the commit that brings
// the first component render test (the Recharts chart), not before.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
