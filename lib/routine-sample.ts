import type { ActiveViewer, PendingRequest, RoutineStatus } from "@/lib/routine-access";
import {
  addDays,
  blocksOn,
  weekdayOf,
  type Block,
  type Change,
  type DayLog,
  type Habit,
  type HabitCheck,
  type ItemKind,
  type RoutineAction,
  type RoutineData,
  type SharedDay,
  type Task,
} from "@/lib/routine-model";

/**
 * Made-up routines for working on the page locally (docs/ROUTINE.md). Everything
 * here is invented and held in memory: it talks to no database, no Google and no
 * Gemini, so nothing done on a sample page can touch the real routine. Only
 * `app/api/routine-sample` uses it, and that route answers in development alone.
 */

export const SCENARIOS = [
  "owner",
  "empty",
  "viewer",
  "visitor",
  "request",
  "pending",
  "denied",
  "unverified",
  "unavailable",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export function scenarioFrom(value: string | null | undefined): Scenario {
  return SCENARIOS.find((scenario) => scenario === value) ?? "owner";
}

type Review = NonNullable<RoutineData["review"]>;

interface SampleChange extends Change {
  batch: string | null;
  undo: () => void;
}

export interface SampleState {
  blocks: Block[];
  tasks: Task[];
  habits: Habit[];
  checks: HabitCheck[];
  logs: DayLog[];
  changes: SampleChange[];
  reviews: Record<string, Review>;
  pending: PendingRequest[];
  active: ActiveViewer[];
  requested: boolean;
  nextChange: number;
}

const COURSES = ["Databases", "Statistics", "Ethics", "Networks"];
const EMAIL = "viewer@example.com";

function block(fields: Partial<Block> & Pick<Block, "title" | "start_min" | "end_min">): Block {
  return {
    id: crypto.randomUUID(),
    weekday: null,
    on_date: null,
    location: "",
    notes: "",
    shareable: false,
    source: "uni",
    ...fields,
  };
}

function task(title: string, due_on: string | null, due_min: number | null = null): Task {
  return {
    id: crypto.randomUUID(),
    title,
    notes: "",
    due_on,
    due_min,
    done_at: null,
    shareable: false,
    source: "uni",
  };
}

export function emptyState(): SampleState {
  return {
    blocks: [],
    tasks: [],
    habits: [],
    checks: [],
    logs: [],
    changes: [],
    reviews: {},
    pending: [],
    active: [],
    requested: false,
    nextChange: 1,
  };
}

/** About what the real page holds: three weeks of classes and 78 Reminders. */
export function fullState(today: string): SampleState {
  const state = emptyState();

  for (let index = 0; index < 21; index += 1) {
    const day = addDays(today, index);
    const weekday = weekdayOf(day);
    if (weekday <= 5) {
      const course = COURSES[weekday % COURSES.length];
      state.blocks.push(
        block({ title: `${course} lecture`, on_date: day, start_min: 490, end_min: 600, location: "Room 204" }),
        block({ title: `${course} lab`, on_date: day, start_min: 840, end_min: 960, location: "Room 118" })
      );
    }
    if (weekday === 6) {
      state.blocks.push(block({ title: "Shift", on_date: day, start_min: 660, end_min: 1140 }));
    }
  }

  state.blocks.push(
    block({ title: "Gym", weekday: 1, start_min: 1080, end_min: 1140, location: "Campus gym", source: "owner" }),
    block({ title: "Dinner with family", on_date: today, start_min: 1200, end_min: 1290, shareable: true, source: "gemini" })
  );

  for (let index = 0; index < 11; index += 1) {
    state.tasks.push(task(`[DEMO10${index % 4}] Overdue quiz ${index + 1}`, addDays(today, -1 - index), 1439));
  }
  for (let index = 0; index < 67; index += 1) {
    const course = COURSES[index % COURSES.length];
    state.tasks.push(task(`[${course}] Read chapter ${index + 1}`, addDays(today, index % 21)));
  }
  state.tasks.push({ ...task("Book a dentist appointment", null), source: "owner" });

  state.habits.push(
    { id: crypto.randomUUID(), title: "Read for 20 minutes", weekdays: [1, 2, 3, 4, 5, 6, 7], source: "owner" },
    { id: crypto.randomUUID(), title: "Stretch", weekdays: [1, 3, 5], source: "gemini" }
  );
  state.checks.push({ habit_id: state.habits[0].id, on_date: today });
  state.logs.push({ on_date: addDays(today, -1), body: "Long day, but the lab went well." });

  state.pending.push({
    id: crypto.randomUUID(),
    email: EMAIL,
    displayName: "Sample Viewer",
    relationship: "A classmate",
    reason: "To see when you're free for the group project.",
    days: 7,
    createdAt: new Date().toISOString(),
  });
  state.active.push({
    id: crypto.randomUUID(),
    email: "friend@example.com",
    displayName: "Sample Friend",
    expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  });

  return state;
}

export function statusFor(state: SampleState, scenario: Scenario): RoutineStatus {
  if (scenario === "owner" || scenario === "empty") {
    return { role: "owner", pending: state.pending, active: state.active };
  }
  if (scenario === "viewer") {
    return { role: "viewer", email: EMAIL, expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() };
  }
  if (scenario === "visitor") return { role: "signedOut" };
  if (scenario === "unverified") return { role: "unverified" };
  if (scenario === "unavailable") return { role: "unavailable" };
  if (scenario === "denied") return { role: "denied", email: EMAIL };
  if (scenario === "pending" || state.requested) return { role: "pending", email: EMAIL };
  return { role: "none", email: EMAIL };
}

/** What a viewer sees, sanitized the same way `routine_shared_days()` is. */
export function sharedDays(state: SampleState, from: string): SharedDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(from, index);
    return {
      date,
      blocks: blocksOn(state.blocks, date).map((item) => ({
        start: item.start_min,
        end: item.end_min,
        title: item.shareable ? item.title : null,
      })),
      tasks: state.tasks
        .filter((item) => item.shareable && !item.done_at && item.due_on === date)
        .map((item) => item.title),
    };
  });
}

export function dataFor(state: SampleState, from: string): RoutineData {
  return {
    blocks: state.blocks,
    tasks: state.tasks,
    habits: state.habits,
    checks: state.checks,
    logs: state.logs,
    changes: [...state.changes]
      .reverse()
      .slice(0, 20)
      .map(({ id, at, actor, item_kind, op, title }) => ({ id, at, actor, item_kind, op, title })),
    syncedAt: new Date().toISOString(),
    review: state.reviews[from] ?? null,
  };
}

function record(
  state: SampleState,
  item_kind: ItemKind,
  op: Change["op"],
  title: string,
  undo: () => void,
  actor = "owner",
  batch: string | null = null
) {
  const id = state.nextChange;
  state.nextChange += 1;
  state.changes.push({ id, at: new Date().toISOString(), actor, item_kind, op, title, batch, undo });
}

function undoChange(state: SampleState, change: SampleChange) {
  change.undo();
  state.changes = state.changes.filter((other) => other.id !== change.id);
}

function listOf(state: SampleState, kind: ItemKind): (Block | Task | Habit)[] {
  if (kind === "block") return state.blocks;
  if (kind === "task") return state.tasks;
  return state.habits;
}

/** One change from the page, as `/api/routine/item` would make it. False if it matched nothing. */
export function applyAction(state: SampleState, action: RoutineAction): boolean {
  switch (action.action) {
    case "save": {
      const list = listOf(state, action.kind);
      const title = (action.values as { title: string }).title;
      const existing = list.find((item) => item.id === action.id);
      if (action.id && !existing) return false;

      if (existing) {
        const before = { ...existing };
        Object.assign(existing, action.values);
        record(state, action.kind, "update", title, () => Object.assign(existing, before));
        return true;
      }

      const base =
        action.kind === "block"
          ? block({ title, start_min: 0, end_min: 1, source: "owner" })
          : action.kind === "task"
            ? { ...task(title, null), source: "owner" }
            : { id: crypto.randomUUID(), title, weekdays: [], source: "owner" };
      const added = Object.assign(base, action.values);
      list.push(added);
      record(state, action.kind, "insert", title, () => {
        list.splice(list.indexOf(added), 1);
      });
      return true;
    }
    case "archive": {
      const list = listOf(state, action.kind);
      const index = list.findIndex((item) => item.id === action.id);
      if (index < 0) return false;
      const [removed] = list.splice(index, 1);
      record(state, action.kind, "update", removed.title, () => {
        list.push(removed);
      });
      return true;
    }
    case "done": {
      const found = state.tasks.find((item) => item.id === action.id);
      if (!found) return false;
      const before = found.done_at;
      found.done_at = action.done ? new Date().toISOString() : null;
      record(state, "task", "update", found.title, () => {
        found.done_at = before;
      });
      return true;
    }
    case "reschedule": {
      const moved = state.tasks.filter((item) => action.ids.includes(item.id));
      for (const item of moved) {
        const { due_on, due_min } = item;
        item.due_on = action.due_on;
        item.due_min = null;
        record(state, "task", "update", item.title, () => Object.assign(item, { due_on, due_min }));
      }
      return moved.length > 0;
    }
    case "check": {
      const matches = (check: HabitCheck) =>
        check.habit_id === action.habit_id && check.on_date === action.on_date;
      state.checks = state.checks.filter((check) => !matches(check));
      if (action.checked) state.checks.push({ habit_id: action.habit_id, on_date: action.on_date });
      return true;
    }
    case "log": {
      state.logs = state.logs.filter((log) => log.on_date !== action.on_date);
      state.logs.push({ on_date: action.on_date, body: action.body });
      return true;
    }
    case "undo": {
      const change = state.changes.find((other) => other.id === action.change);
      if (!change) return false;
      undoChange(state, change);
      return true;
    }
    case "undo_note": {
      const changes = state.changes.filter((other) => other.batch === action.batch);
      for (const change of changes.reverse()) undoChange(state, change);
      return changes.length > 0;
    }
  }
}

/**
 * A stand-in for Gemini, for seeing each state of the note box: a note with
 * "error" or "limit" in it fails, one ending in a question mark is answered, and
 * anything else becomes a task with Undo beside it.
 */
export function organizeNote(
  state: SampleState,
  note: string,
  today: string
): { status: number; body: unknown } {
  const lower = note.toLowerCase();
  if (lower.includes("error")) return { status: 422, body: { error: "gemini_bad" } };
  if (lower.includes("limit")) return { status: 429, body: { error: "daily_limit" } };
  if (note.trim().endsWith("?")) {
    return {
      status: 200,
      body: { message: "This is a sample answer. Nothing was changed.", batch: null },
    };
  }

  const added = { ...task(note.slice(0, 200), today), source: "gemini" };
  const batch = crypto.randomUUID();
  state.tasks.push(added);
  record(state, "task", "insert", added.title, () => {
    state.tasks.splice(state.tasks.indexOf(added), 1);
  }, "gemini", batch);
  return { status: 200, body: { message: `Added "${added.title}" for today.`, batch } };
}

export function reviewWeek(state: SampleState, week: string): Review {
  const review = {
    went_well: ["You finished two labs on time.", "You kept reading on most days."],
    slipped: ["Eleven quizzes are past due and still open."],
    next_week: ["Clear the overdue list first.", "Start the group project early."],
  };
  state.reviews[week] = review;
  return review;
}
