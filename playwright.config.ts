import { defineConfig } from "@playwright/test";

// Phase 1 verify (T5): one end-to-end journey in a real browser. Starts the
// Vite dev server, drives the actual UI, and asserts on the rendered DOM. See
// e2e/steel-thread.spec.ts for the mock-OpenRouter / real-Convex split.
export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
