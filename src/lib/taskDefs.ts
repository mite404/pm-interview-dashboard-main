// 18 · Task defs (the mutation's companion read) - the pure calc feeding the
// read-only task list. Shapes raw `listAll` docs into flat row view-models so
// the component stays dumb (same split as `toAgentRunRows`): it folds the cron
// expression + timezone into one schedule string and keeps only the fields the
// admin needs to eyeball a task and the model needs to resolve a name -> id.
// NOT the Task Control card (design 07, with its pause/resume controls) - that
// is a separate, mutation-owning surface.

import type { TaskDefsList } from "./types";

// The lifecycle enum, derived from the doc so it can't drift from the backend's
// `v.union(...)`: "active" | "paused" | "cancelled".
export type TaskStatus = TaskDefsList[number]["status"];

export interface TaskRow {
  id: string;
  name: string;
  status: TaskStatus;
  /** cron expression + timezone folded into one display string. */
  schedule: string;
  /** The task's natural-language description of what it does. */
  query: string;
}

/**
 * Shapes a raw `listAll` return into the table's rows.
 * @param tasks - the typed Convex query return (`TaskDefsList`)
 */
export function toTaskRows(tasks: TaskDefsList): TaskRow[] {
  return tasks.map((task) => ({
    id: task._id,
    name: task.name,
    status: task.status,
    schedule: `${task.cronExpression} (${task.timezone})`,
    query: task.naturalLanguageQuery,
  }));
}
