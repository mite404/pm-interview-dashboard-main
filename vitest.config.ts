import { defineConfig } from "vitest/config";

// Vitest reads this in preference to vite.config.ts. We omit the React
// Fast-Refresh plugin (its babel options warn under Vitest); JSX in .tsx tests
// is transformed by Vitest 4's built-in oxc, which honours tsconfig's
// `jsx: "react-jsx"`. The default environment stays `node` for the fast pure
// calc/parse tests; the one render test opts into jsdom with a per-file
// `// @vitest-environment jsdom` comment, so only it pays for a DOM.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
