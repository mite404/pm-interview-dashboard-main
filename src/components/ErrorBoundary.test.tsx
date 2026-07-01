// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the fallback when a child throws, without letting it propagate", () => {
    // React (dev) both logs the caught error via console.error AND re-dispatches
    // it as a window `error` event that jsdom would otherwise print. Silence the
    // first and mark the second handled, so the test output stays clean - the
    // catching itself is what we assert.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const markHandled = (event: ErrorEvent) => {
      event.preventDefault();
    };
    window.addEventListener("error", markHandled);

    try {
      render(
        <ErrorBoundary fallback={<div>Couldn&apos;t render this result.</div>}>
          <Bomb />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Couldn't render this result.")).toBeDefined();
    } finally {
      window.removeEventListener("error", markHandled);
    }
  });

  it("renders its children unchanged when nothing throws", () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <div>healthy content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("healthy content")).toBeDefined();
  });
});
