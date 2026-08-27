# Terminal Command Crash Course: Focused Testing

> [!TIP]
> **The Analogy:** Think of testing like lighting a theater stage.
> **Floodlight Testing** is turning on every light in the house. It's great for a final dress
> rehearsal (E2E tests), but it's expensive and can hide small mistakes.
> **Spotlight Testing** is precisely lighting only the actor who just stepped into the scene. It’s
> faster, more focused, and helps you catch errors immediately without the "noise" of the rest of
> the production.

---

## Why Focused Testing Exists

In large projects, running a full test suite for a one-line change is like checking the entire
theater's fire safety systems just because you changed a chair in the front row. Focused testing
exists to:

1. **Minimize Feedback Loops:** Get results in seconds, not minutes.
2. **Isolate Side Effects:** Ensure that changing `A` didn't accidentally break `B`.
3. **Save Resources:** Reduce compute costs and "token bloat" during development.

---

## The Patterns

### 1. The Diff (The Script Review)

Before you test, you must know what changed. If you don't know what changed, you can't know what to
test.

**The Command:**

```bash
git diff --stat
```

**How to harness it:**
Use this to see a high-level summary of which files were touched. If you only changed files in
`src/models/`, you know your spotlight should be aimed there.

### 2. The Target (The Spotlight)

Most modern test runners allow you to pass a filename or a string to execute only specific tests.

**The Command:**

```bash
npm test -- src/models/user.test.ts
```

_(Note: The exact flag depends on your runner, e.g., `jest`, `vitest`, or `mocha`)_

**How to harness it:**
Instead of waiting for 200 tests to pass, run only the test file associated with the logic you just
modified. This is the "Spotlight" in action.

### 3. The Symbol Search (The Script Search)

If you change a constant or a shared utility, you need to know every "scene" that uses it.

**The Command:**

```bash
grep -r "ZOD_SCHEMA_KEY" ./src
```

**How to harness it:**
When you modify a shared dependency, use `grep` to identify every file that imports it. This tells
you exactly which files need to be added to your "Spotlight" test plan.

### 4. The Token Proxy (The Production Value)

When running commands that produce long lists of output, use the token-optimized proxy to ensure the
LLM doesn't get overwhelmed by "scenery" it doesn't need to see.

**The Command:**

```bash
ls -R | head -n 20
```

**How to harness it:**
By prefixing with ``, you ensure that only the relevant parts of the terminal output reach the
context, preventing the "signal" (your errors) from getting lost in the "noise" (the directory
tree).

---

## Quick Reference Table

| Goal                   | Pattern       | Command Example      | Why use it?                                 |
| :--------------------- | :------------ | :------------------- | :------------------------------------------ |
| **Scope Discovery**    | The Diff      | `git diff --stat`    | Identifies exactly which "scenes" changed.  |
| **Targeted Execution** | The Spotlight | `npm test -- <path>` | Runs only the test for the changed code.    |
| **Impact Analysis**    | Symbol Search | `grep -r "term" .`   | Finds every file affected by a change.      |
| **Noise Reduction**    | Token Proxy   | `<command>`          | Keeps the agent focused on relevant output. |

---

## Director's Commentary

When you are in the middle of a feature, **always start with a Diff.**
If the Diff shows you touched 10 files, your test plan should include a Spotlight on those 10 files.
If you find yourself running the full test suite every time you save a file, you're using a
Floodlight when you only need a Spotlight.
