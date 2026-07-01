import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { AggregateStats, GroupsList } from "./types";
import {
  toConversations,
  toStatusBars,
  validateAggregateStats,
  validateListByChatJid,
  validateListConversations,
  validateListRecent,
  validateTokenUsage,
} from "./tools";

// A stable, all-time stats fixture mirroring the seeded deployment:
// 39 invocations = 24 succeeded + 8 active + 7 failed; finished = 24 + 7 = 31.
const seededStats: AggregateStats = {
  total: 39,
  active: 8,
  succeeded: 24,
  finishedCount: 31,
  avgDuration: 1234,
};

describe("validateAggregateStats (getAggregateStats args)", () => {
  it("returns empty args when the LLM passes none", () => {
    expect(validateAggregateStats({})).toEqual({});
    expect(validateAggregateStats(undefined)).toEqual({});
  });

  it("passes through a valid after timestamp", () => {
    expect(validateAggregateStats({ after: 1000 })).toEqual({ after: 1000 });
  });

  it("passes through a valid groupFolder", () => {
    expect(validateAggregateStats({ groupFolder: "maya-web" })).toEqual({
      groupFolder: "maya-web",
    });
  });

  it("throws when after is not a number", () => {
    expect(() => validateAggregateStats({ after: "soon" })).toThrow();
  });

  it("throws when groupFolder is not a string", () => {
    expect(() => validateAggregateStats({ groupFolder: 5 })).toThrow();
  });

  it("throws when given a non-object", () => {
    expect(() => validateAggregateStats("nope")).toThrow();
    expect(() => validateAggregateStats([])).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateAggregateStats({ days: 7 })).toThrow(/days/);
  });
});

describe("validateTokenUsage (getAggregateTokenUsage args)", () => {
  it("defaults after to 0 (all-time) when the model passes none", () => {
    expect(validateTokenUsage({})).toEqual({ after: 0 });
    expect(validateTokenUsage(undefined)).toEqual({ after: 0 });
  });

  it("passes through a valid after window", () => {
    expect(validateTokenUsage({ after: 1000 })).toEqual({ after: 1000 });
  });

  it("throws when after is not a number", () => {
    expect(() => validateTokenUsage({ after: "soon" })).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateTokenUsage({ days: 7 })).toThrow(/days/);
  });
});

describe("validateListRecent (listRecent args)", () => {
  it("returns empty args when the LLM passes none", () => {
    expect(validateListRecent({})).toEqual({});
    expect(validateListRecent(undefined)).toEqual({});
  });

  it("passes through limit and after", () => {
    expect(validateListRecent({ limit: 10, after: 1000 })).toEqual({
      limit: 10,
      after: 1000,
    });
  });

  it("accepts a valid status filter", () => {
    expect(validateListRecent({ status: "failed" })).toEqual({
      status: "failed",
    });
  });

  it("throws on a status outside the enum, naming the allowed values", () => {
    expect(() => validateListRecent({ status: "broken" })).toThrow(/failed/);
  });

  it("throws when limit is not a number", () => {
    expect(() => validateListRecent({ limit: "ten" })).toThrow();
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() => validateListRecent({ groupFolder: "maya" })).toThrow(
      /groupFolder/,
    );
  });
});

describe("validateListConversations (listConversations args)", () => {
  it("returns empty args when the LLM passes none", () => {
    expect(validateListConversations({})).toEqual({});
    expect(validateListConversations(undefined)).toEqual({});
  });

  it("throws on any argument, since the tool takes none", () => {
    expect(() => validateListConversations({ jid: "maya@web" })).toThrow(/jid/);
  });
});

describe("validateListByChatJid (listByChatJid args)", () => {
  it("accepts a non-empty chatJid alone", () => {
    expect(validateListByChatJid({ chatJid: "maya@web" })).toEqual({
      chatJid: "maya@web",
    });
  });

  it("passes an optional limit through", () => {
    expect(validateListByChatJid({ chatJid: "maya@web", limit: 20 })).toEqual({
      chatJid: "maya@web",
      limit: 20,
    });
  });

  it("throws when chatJid is missing", () => {
    expect(() => validateListByChatJid({})).toThrow(/chatJid/);
  });

  it("throws when chatJid is empty or whitespace", () => {
    expect(() => validateListByChatJid({ chatJid: "" })).toThrow(/chatJid/);
    expect(() => validateListByChatJid({ chatJid: "   " })).toThrow(/chatJid/);
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() =>
      validateListByChatJid({ chatJid: "maya@web", days: 7 }),
    ).toThrow(/days/);
  });
});

describe("toConversations", () => {
  // A minimally-complete registeredGroups doc; the transform only reads name/jid.
  const group = (over: Partial<GroupsList[number]>): GroupsList[number] => ({
    _id: "g1" as Id<"registeredGroups">,
    _creationTime: 0,
    jid: "maya@web",
    name: "Maya Patel",
    folder: "maya-web",
    triggerPattern: ".*",
    personId: "p1" as Id<"persons">,
    ...over,
  });

  it("narrows each group to just name and jid, dropping the rest", () => {
    expect(
      toConversations([
        group({ name: "Maya Patel", jid: "maya@web" }),
        group({ name: "Sam Rivera", jid: "sam@sms", folder: "sam-sms" }),
      ]),
    ).toEqual([
      { name: "Maya Patel", jid: "maya@web" },
      { name: "Sam Rivera", jid: "sam@sms" },
    ]);
  });
});

describe("toStatusBars", () => {
  it("derives succeeded, active, and failed bars (failed = finishedCount - succeeded)", () => {
    expect(toStatusBars(seededStats)).toEqual([
      { status: "succeeded", count: 24 },
      { status: "active", count: 8 },
      { status: "failed", count: 7 },
    ]);
  });

  it("produces three bars that sum to total", () => {
    const sum = toStatusBars(seededStats).reduce((n, b) => n + b.count, 0);
    expect(sum).toBe(seededStats.total);
  });
});
