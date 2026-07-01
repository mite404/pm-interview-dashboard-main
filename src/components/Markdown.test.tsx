// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders a GFM table as a real HTML table", () => {
    const md = "| Status | Count |\n| --- | --- |\n| succeeded | 24 |";
    render(<Markdown>{md}</Markdown>);

    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("24")).toBeDefined();
  });

  it("renders inline emphasis as markup, not literal asterisks", () => {
    render(<Markdown>{"**bold** text"}</Markdown>);

    const strong = screen.getByText("bold");
    expect(strong.tagName).toBe("STRONG");
  });
});
