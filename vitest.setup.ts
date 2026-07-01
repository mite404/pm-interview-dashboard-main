// Global test setup: registers Testing Library's DOM cleanup after every
// test. Testing Library only self-registers this automatically when it finds
// a global `afterEach`, and this project's tests import `afterEach` etc.
// explicitly from "vitest" rather than enabling `globals: true`, so without
// this file the auto-registration silently no-ops - any render-test file
// with more than one `it()` would leak each render's DOM into the next test.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
