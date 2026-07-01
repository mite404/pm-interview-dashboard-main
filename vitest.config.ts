import path from "node:path";
import { defineConfig } from "vitest/config";

// Vitest reads this in preference to vite.config.ts, so the `@` alias (added
// for shadcn/ui's generated imports) has to be repeated here rather than
// shared - Vitest doesn't fall back to vite.config.ts for anything once this
// file exists. We omit the React Fast-Refresh plugin (its babel options warn
// under Vitest); JSX in .tsx tests is transformed by Vitest 4's built-in oxc,
// which honours tsconfig's `jsx: "react-jsx"`. The default environment stays
// `node` for the fast pure calc/parse tests; render tests opt into jsdom with
// a per-file `// @vitest-environment jsdom` comment, so only those pay for a DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
