import { expect, test } from "@playwright/test";

// The steel thread, verified in a real browser: type a question, and prove the
// admin sees the tool pill, streamed text, and a chart of REAL Convex data.
//
// Boundary split (per docs/PLAN.md): OpenRouter is mocked at the network layer
// (the LLM is non-deterministic and costs tokens, so "the chart shows 24" could
// not be a stable assertion), while Convex stays real - that is what proves the
// typed-api wiring end to end. So the prose is scripted, but 24 / 8 / 7 / 39
// come from the live backend.

// Routing turn: the model chooses getAggregateStats (no args).
const ROUTING_RESPONSE = {
  choices: [
    {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_e2e",
            type: "function",
            function: { name: "getAggregateStats", arguments: "{}" },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
};

// Answer turn: a streamed reply. Deliberately free of the chart's status words,
// so asserting "succeeded" proves the chart rendered, not the prose.
const ANSWER_TEXT = "Here is the current agent run breakdown.";
const ANSWER_SSE =
  `data: {"choices":[{"delta":{"content":"Here is the current "}}]}\n\n` +
  `data: {"choices":[{"delta":{"content":"agent run breakdown."}}]}\n\n` +
  `data: [DONE]\n\n`;

test("question -> tool pill -> streamed answer -> chart of real Convex data", async ({
  page,
}) => {
  // Mock both OpenRouter turns, told apart by the `stream` flag in the body.
  await page.route(
    "https://openrouter.ai/api/v1/chat/completions",
    async (route) => {
      const isAnswerTurn =
        route.request().postData()?.includes('"stream":true') ?? false;
      await route.fulfill(
        isAnswerTurn
          ? { status: 200, contentType: "text/event-stream", body: ANSWER_SSE }
          : {
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(ROUTING_RESPONSE),
            },
      );
    },
  );

  // Convex stays real. Delay it so the "Running…" pill stays on screen long
  // enough to assert deterministically (it clears when the turn completes).
  await page.route(/utmost-poodle-412\.convex\.cloud/, async (route) => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 700);
    });
    await route.continue();
  });

  await page.goto("/");
  await page
    .getByPlaceholder("Ask about agent runs…")
    .fill("how are our agent runs doing?");
  await page.getByRole("button", { name: "Send" }).click();

  // Must #6: the tool-status pill shows the tool executing.
  await expect(page.getByText(/Running getAggregateStats/)).toBeVisible();

  // Must #5: the streamed answer text appears.
  await expect(page.getByText(ANSWER_TEXT)).toBeVisible();

  // Must #4: the chart renders real Convex data. The KPI total (39) proves real
  // Convex data reached the UI; `succeeded` (a Recharts-drawn x-axis label) plus
  // the container testid prove the chart actually rendered its content, not just
  // that a div exists. The exact derived bar value (failed = finishedCount -
  // succeeded) is covered by the toStatusBars unit test and the chart render
  // test - the right layer for a value check, and collision-proof there.
  await expect(page.getByText("Total runs: 39")).toBeVisible();
  await expect(page.getByText("succeeded")).toBeVisible();
  await expect(page.getByTestId("status-breakdown-chart")).toBeVisible();
});
