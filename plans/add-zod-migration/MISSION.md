# Mission: Reading production full-stack TypeScript

## Why

Ethan built the PlanMonster admin dashboard (`web/fractal/pm-interview-dashboard-main`)
as a take-home: a conversational Convex dashboard where an admin asks in plain
language and an LLM tool-call fetches the metric. The brief supplied only a slice
of the Convex backend; the architecture is his, and `docs/PLAN.md` records the
reasoning. The code is good.

The gap is not knowledge, it is **retrieval**. A design you can explain with the
plan doc open is not yet a design you can defend cold, in a review or an interview,
or reproduce on a project where no plan doc exists. Knowing _which_ of these
patterns are industry-standard and which are idiosyncratic is the same problem
from the other side.

The route there is reading real open-source codebases that solve the same
problems, not tutorials that solve toy ones.

## Success looks like

- Open an unfamiliar full-stack repo and trace one round trip (click → HTTP →
  handler → validation → DB → response → render) without getting lost.
- Point at any typed value in that repo and say where its shape is _defined_
  and where it is _derived_.
- Explain, out loud, why PlanMonster derives types from the Convex `api` and
  Dub derives them from a Zod schema — and what each buys and costs.
- Write a new tool / endpoint in PlanMonster where the runtime check and the
  static type cannot drift apart.
- Read an error-handling path in real code and name what it protects against.
- Reproduce, with the docs closed, the arguments already recorded in `docs/` —
  why the registry erases types (contravariance), why the LLM is scripted in tests,
  why tool errors feed back but channel errors abort.

## Constraints

- Stack focus: TypeScript. Next.js + Postgres exemplars, plus his own Convex +
  Vite app as the anchor project.
- Background: Full Stack Open through part 9 (`web/fullstackopen/part9-typescript`),
  Express 5 + Mongoose (`web/phonebook-backend`). REST and `fetch` are known.
- Wants real code over invented examples. Every claim cites a file and line in
  a repo he can open.
- Teach at defense level, not exposition level. He has already read good
  explanations of most of this; re-explaining builds fluency, not retention.
- Lessons short enough to finish in one sitting.

## Out of scope

- Framework tours. Not learning Next.js as a subject.
- Deployment, infra, CI.
- Rewriting PlanMonster. It ships as-is; it is a specimen, not a project.
