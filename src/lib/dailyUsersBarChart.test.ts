import { describe, expect, it } from "vitest";
import type { DailyUniqueUsers } from "./types";
import { toDailyUsersBarData } from "./dailyUsersBarChart";

describe("toDailyUsersBarData", () => {
  it("highlights the max day orange and formats UTC day labels", () => {
    const rows: DailyUniqueUsers = [
      { day: "2025-06-16", uniqueUsers: 128 },
      { day: "2025-06-17", uniqueUsers: 156 },
      { day: "2025-06-18", uniqueUsers: 172 },
      { day: "2025-06-19", uniqueUsers: 88 },
    ];

    const bars = toDailyUsersBarData(rows);

    expect(bars).toEqual([
      { label: "Jun 16", value: 128, fill: "var(--color-dc-navy)" },
      { label: "Jun 17", value: 156, fill: "var(--color-dc-navy)" },
      { label: "Jun 18", value: 172, fill: "var(--color-dc-orange)" },
      { label: "Jun 19", value: 88, fill: "var(--color-dc-navy)" },
    ]);
  });

  it("highlights nothing when every day is zero (sparse wide window)", () => {
    const rows: DailyUniqueUsers = [
      { day: "2025-05-01", uniqueUsers: 0 },
      { day: "2025-05-02", uniqueUsers: 0 },
    ];

    const bars = toDailyUsersBarData(rows);
    expect(bars.every((b) => b.fill === "var(--color-dc-navy)")).toBe(true);
  });

  it("handles an empty window without throwing", () => {
    expect(toDailyUsersBarData([])).toEqual([]);
  });
});
