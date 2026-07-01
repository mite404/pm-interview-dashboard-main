import { describe, expect, it, vi } from "vitest";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { runTurn } from "./loop";
import type { LoopDeps, TurnHooks } from "./loop";
import type { ToolCall, WireMessage } from "./openrouter";
import {
  makeRunTool,
  registry,
  runPause,
  runResume,
  validateTaskDefId,
} from "./tools";
import type { TaskDef, TaskDefsList, ToolDeps, ToolStatus } from "./types";

// The patched task doc pause/resume return - only the fields the flow reads are
// asserted, so a partial doc cast to `TaskDef` keeps the fixture honest.
const pausedTask = {
  _id: "k100000000000000000000000000000",
  name: "Daily Project Accounting",
  status: "paused",
} as unknown as NonNullable<TaskDef>;

// The list the REAL `listAll` (PR 2's tool) returns via Convex, resolved by the
// spied client below so the name-resolution flow runs without the deployment.
const taskList = [
  {
    _id: pausedTask._id,
    name: "Daily Project Accounting",
    status: "active",
    cronExpression: "0 6 * * *",
  },
] as unknown as TaskDefsList;

// A spied Convex client: `mutation` resolves the patched-doc fixture and records
// its call; `query` resolves the task list for listAll. Both run WITHOUT touching
// the live shared deployment (which would flip real task state - see the brief's
// constraints). Cast through `unknown` since we stub only the methods the tools
// reach for.
function spyConvex(patchedDoc: TaskDef) {
  const mutation = vi.fn().mockResolvedValue(patchedDoc);
  const query = vi.fn().mockResolvedValue(taskList);
  const deps: ToolDeps = {
    convex: { mutation, query } as unknown as ConvexHttpClient,
  };
  return { deps, mutation };
}

// ── validate: structural safety (layer 1 of 3) ───────────────────────────
// pause and resume share `validateTaskDefId`; it only proves the args are
// well-formed (a non-empty id string), not that the id exists.
describe("validateTaskDefId (structural id check)", () => {
  it("accepts a well-formed id, narrowing to typed args", () => {
    expect(validateTaskDefId("pause", { taskDefId: "abc" })).toEqual({
      taskDefId: "abc",
    });
    expect(validateTaskDefId("resume", { taskDefId: "abc" })).toEqual({
      taskDefId: "abc",
    });
  });

  it("throws when the id is missing", () => {
    expect(() => validateTaskDefId("pause", {})).toThrow(/taskDefId/);
  });

  it("throws on an empty-string id (not well-formed)", () => {
    expect(() => validateTaskDefId("pause", { taskDefId: "" })).toThrow(
      /taskDefId/,
    );
  });

  it("throws when the id is not a string", () => {
    expect(() => validateTaskDefId("pause", { taskDefId: 5 })).toThrow(
      /taskDefId/,
    );
  });

  it("throws on an unknown key, naming it so the LLM can self-correct", () => {
    expect(() =>
      validateTaskDefId("pause", { taskDefId: "abc", name: "x" }),
    ).toThrow(/name/);
  });

  it("throws when given a non-object", () => {
    expect(() => validateTaskDefId("pause", "nope")).toThrow();
    expect(() => validateTaskDefId("pause", [])).toThrow();
  });
});

// ── run: the action, against a spied client ──────────────────────────────
describe("runPause / runResume (spied Convex)", () => {
  it("pause calls the pause mutation with the id and returns the patched doc", async () => {
    const { deps, mutation } = spyConvex(pausedTask);

    const result = await runPause({ taskDefId: pausedTask._id }, deps);

    expect(mutation).toHaveBeenCalledExactlyOnceWith(
      api.intelligenceTaskDefs.pause,
      { taskDefId: pausedTask._id },
    );
    expect(result).toBe(pausedTask);
  });

  it("resume calls the resume mutation with the id", async () => {
    const { deps, mutation } = spyConvex(pausedTask);

    await runResume({ taskDefId: pausedTask._id }, deps);

    expect(mutation).toHaveBeenCalledExactlyOnceWith(
      api.intelligenceTaskDefs.resume,
      { taskDefId: pausedTask._id },
    );
  });
});

// ── integration: the listAll -> pause flow ───────────────────────────────
// The loop wired to the REAL registry + a spied Convex client, driven by a
// scripted "LLM" (decideTool). This proves the flow WIRING, not the model's
// judgment: the ambiguity decision itself is the prompt's job (prompt.test.ts).

function scriptDecideTool(script: (ToolCall | null)[]): LoopDeps["decideTool"] {
  let i = 0;
  return () => Promise.resolve(i < script.length ? script[i++] : null);
}

function makeHooks() {
  const statuses: ToolStatus[] = [];
  const hooks: TurnHooks = {
    onDelta: vi.fn(),
    onToolStatus: (status) => {
      statuses.push(status);
    },
  };
  return { hooks, statuses };
}

describe("listAll -> pause flow (integration, scripted LLM)", () => {
  it("unambiguous: resolves a name via listAll, pauses in one shot, feeds the named doc back", async () => {
    const { deps: toolDeps, mutation } = spyConvex(pausedTask);
    let answered: WireMessage[] = [];
    const deps: LoopDeps = {
      decideTool: scriptDecideTool([
        { id: "c1", name: "listAll", args: {} },
        // The model resolved "Daily Project Accounting" to its id from listAll.
        { id: "c2", name: "pause", args: { taskDefId: pausedTask._id } },
        null,
      ]),
      runTool: makeRunTool(registry, toolDeps),
      streamAnswer: (messages, onDelta) => {
        answered = messages;
        onDelta("Paused Daily Project Accounting.");
        return Promise.resolve("Paused Daily Project Accounting.");
      },
      tools: [],
      maxSteps: 5,
    };
    const { hooks } = makeHooks();

    const result = await runTurn(
      [{ role: "user", content: "pause the daily project accounting task" }],
      hooks,
      deps,
    );

    // The write fired exactly once, with the resolved id.
    expect(mutation).toHaveBeenCalledExactlyOnceWith(
      api.intelligenceTaskDefs.pause,
      { taskDefId: pausedTask._id },
    );
    // The renderable result is the pause result (last tool in the chain).
    expect(result.toolResult).toEqual({ tool: "pause", data: pausedTask });
    // Layer 3: the patched doc's name reached the model, so it can acknowledge
    // the exact target - a wrong task would be visible here.
    const toolMessages = answered.filter((m) => m.role === "tool");
    expect(
      toolMessages.some((m) => m.content?.includes("Daily Project Accounting")),
    ).toBe(true);
  });

  it("ambiguous: lists, then asks instead of writing - no mutation fires", async () => {
    const { deps: toolDeps, mutation } = spyConvex(pausedTask);
    const deps: LoopDeps = {
      decideTool: scriptDecideTool([
        { id: "c1", name: "listAll", args: {} },
        null, // the model chose to ask rather than pause
      ]),
      runTool: makeRunTool(registry, toolDeps),
      streamAnswer: (_messages, onDelta) => {
        const ask =
          'Two tasks match "daily": Daily Project Accounting and Daily Standup Summary. Which one?';
        onDelta(ask);
        return Promise.resolve(ask);
      },
      tools: [],
      maxSteps: 5,
    };
    const { hooks } = makeHooks();

    const result = await runTurn(
      [{ role: "user", content: "pause the daily task" }],
      hooks,
      deps,
    );

    // No write happened - the ambiguous path never reaches a mutation.
    expect(mutation).not.toHaveBeenCalled();
    expect(result.text).toMatch(/which one/i);
    // The only tool that ran was the read (listAll).
    expect(result.toolResult?.tool).toBe("listAll");
  });
});
