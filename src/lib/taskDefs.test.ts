import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { TaskDefsList } from "./types";
import { toTaskRows } from "./taskDefs";

type Task = TaskDefsList[number];

// A minimally-complete intelligenceTaskDefs doc; each test overrides just the
// fields the transform reads (name/status/cronExpression/timezone/query).
function task(over: Partial<Task>): Task {
  return {
    _id: "t1" as Id<"intelligenceTaskDefs">,
    _creationTime: 0,
    name: "Daily Project Accounting",
    naturalLanguageQuery: "summarize spend per project daily",
    prompt: "...",
    cronExpression: "0 9 * * *",
    timezone: "America/New_York",
    cronName: "daily-accounting",
    status: "active",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("toTaskRows", () => {
  it("folds cron + timezone into one schedule string and keeps status", () => {
    const [row] = toTaskRows([task({ status: "paused" })]);
    expect(row.status).toBe("paused");
    expect(row.schedule).toBe("0 9 * * * (America/New_York)");
    expect(row.name).toBe("Daily Project Accounting");
    expect(row.query).toBe("summarize spend per project daily");
  });

  it("preserves order and maps each task to a row", () => {
    const rows = toTaskRows([
      task({ _id: "a" as Id<"intelligenceTaskDefs">, name: "A" }),
      task({ _id: "b" as Id<"intelligenceTaskDefs">, name: "B" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["A", "B"]);
  });
});
