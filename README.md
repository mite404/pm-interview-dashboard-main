# PlanMonster Admin Dashboard

A conversational (chat-based) admin dashboard built on a Convex backend.
An admin types natural language and gets back data, visualizations, and insights,
driven by an LLM with tool-calling that maps requests to Convex functions.

## Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key (for the chat LLM)

## Setup

```bash
git clone <repo-url>
cd pm-interview-dashboard-main
bun install
cp .env.example .env.local   # then fill in the values below
bun run dev
```

The app runs at the URL Vite prints (default `http://localhost:5173`).

## Environment variables

Set these in `.env.local`:

| Variable                  | Required | Default                                  | Notes                                                             |
| ------------------------- | -------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `VITE_CONVEX_URL`         | yes      | `https://utmost-poodle-412.convex.cloud` | The deployed Convex backend (already seeded with synthetic data). |
| `VITE_OPENROUTER_API_KEY` | yes      | -                                        | Your OpenRouter key. Powers the chat LLM.                         |
| `VITE_OPENROUTER_MODEL`   | no       | `anthropic/claude-haiku-4.5`             | Must be a currently-routable OpenRouter slug.                     |

## Scripts

| Command            | What it does                      |
| ------------------ | --------------------------------- |
| `bun run dev`      | Start the Vite dev server         |
| `bun run build`    | Production build                  |
| `bun run preview`  | Preview the production build      |
| `bun test`         | Run unit tests (Vitest)           |
| `bun run test:e2e` | Run end-to-end tests (Playwright) |
| `bun run lint`     | Lint                              |
| `bun run format`   | Format with Prettier              |
| `bun run codegen`  | Regenerate the typed Convex API   |
| `bun run probe:backend` | Probe the Convex backend to spot-check data |
