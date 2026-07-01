// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskControl } from "./TaskControl";

const task = {
  name: "Daily Project Accounting",
  schedule: "intelligenceTaskDefs · runs 06:00 UTC",
};

describe("TaskControl", () => {
  it("renders the Active state: green badge + Pause Task button", () => {
    render(
      <TaskControl
        task={task}
        status="active"
        onToggle={vi.fn()}
        onRunNow={vi.fn()}
      />,
    );
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByRole("button", { name: /pause task/i })).toBeDefined();
  });

  it("renders the Paused state: amber badge + Resume Task button", () => {
    render(
      <TaskControl
        task={task}
        status="paused"
        onToggle={vi.fn()}
        onRunNow={vi.fn()}
      />,
    );
    expect(screen.getByText("Paused")).toBeDefined();
    expect(screen.getByRole("button", { name: /resume task/i })).toBeDefined();
  });

  it("optimistically flips, shows the mono toast, and calls onToggle('paused')", () => {
    const onToggle = vi.fn();
    render(
      <TaskControl
        task={task}
        status="active"
        onToggle={onToggle}
        onRunNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /pause task/i }));

    // Optimistic flip is synchronous with the click.
    expect(screen.getByRole("button", { name: /resume task/i })).toBeDefined();
    expect(screen.getByText("Paused")).toBeDefined();
    expect(
      screen.getByText(/intelligenceTaskDefs\.pause — task suspended/),
    ).toBeDefined();
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("paused");
  });

  it("reverts the optimistic flip when the mutation rejects", async () => {
    const onToggle = vi.fn().mockRejectedValue(new Error("network down"));
    render(
      <TaskControl
        task={task}
        status="active"
        onToggle={onToggle}
        onRunNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /pause task/i }));
    // Let the rejected promise settle so the revert runs.
    await Promise.resolve();

    expect(
      await screen.findByRole("button", { name: /pause task/i }),
    ).toBeDefined();
    expect(screen.queryByText(/task suspended/)).toBeNull();
  });

  it("fires Run Now without toggling", () => {
    const onRunNow = vi.fn();
    render(
      <TaskControl
        task={task}
        status="active"
        onToggle={vi.fn()}
        onRunNow={onRunNow}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    expect(onRunNow).toHaveBeenCalledOnce();
    // Still active - Run Now does not flip the toggle.
    expect(screen.getByRole("button", { name: /pause task/i })).toBeDefined();
  });
});
