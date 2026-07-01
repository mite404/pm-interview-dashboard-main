import { describe, expect, it } from "vitest";
import type { DailyUniqueUsers } from "./types";
import { toDailyUsersLineData } from "./dailyUsersLineChart";

describe("toDailyUsersLineData", () => {
  it("formats UTC day labels and preserves counts in order", () => {
    const rows: DailyUniqueUsers = [
      { day: "2025-06-16", uniqueUsers: 128 },
      { day: "2025-06-17", uniqueUsers: 156 },
      { day: "2025-06-18", uniqueUsers: 172 },
    ];

    expect(toDailyUsersLineData(rows)).toEqual([
      { label: "Jun 16", value: 128 },
      { label: "Jun 17", value: 156 },
      { label: "Jun 18", value: 172 },
    ]);
  });

  it("handles an empty window without throwing", () => {
    expect(toDailyUsersLineData([])).toEqual([]);
  });
});
