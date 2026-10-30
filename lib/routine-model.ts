/**
 * The organizer's data and rules: what a day holds, and what a save may contain.
 * Pure on purpose, so `npm test` covers what the vault can't exercise. No
 * server-only imports: `components/RoutineOrganizer.tsx` is a client component.
 *
 * Dates are "YYYY-MM-DD" strings in the owner's own calendar, and times are
 * minutes since midnight. Neither is an instant, so neither passes through a
 * time zone. Weekdays are ISO: 1 is Monday, 7 is Sunday.
 */

export type ItemKind = "block" | "task" | "habit";

export interface Block {
  id: string;
  title: string;
  weekday: number | null;
  on_date: string | null;
  start_min: number;
  end_min: number;
  location: string;
  notes: string;
  shareable: boolean;
  source: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  due_on: string | null;
  due_min: number | null;
  done_at: string | null;
  shareable: boolean;
  source: string;
}

export interface Habit {
  id: string;
  title: string;
  weekdays: number[];
  source: string;
}

export interface HabitCheck {
  habit_id: string;
  on_date: string;
}

export interface DayLog {
  on_date: string;
  body: string;
}

export interface Change {
  id: number;
  at: string;
  actor: string;
  item_kind: ItemKind;
  op: "insert" | "update";
  title: string;
}

export interface RoutineData {
  blocks: Block[];
  tasks: Task[];
  habits: Habit[];
  checks: HabitCheck[];
  logs: DayLog[];
  changes: Change[];
}

/** One day of what a viewer may see, from `routine_shared_days()`. A null title means Busy. */
export interface SharedDay {
  date: string;
  blocks: { start: number; end: number; title: string | null }[];
  tasks: string[];
}

const MAX_TITLE = 200;
const MAX_LOCATION = 200;
const MAX_NOTES = 2000;
export const MAX_LOG = 5000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The reader's own calendar date. */
export function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The Monday of the week holding this date. */
export function weekStart(iso: string): string {
  return addDays(iso, 1 - weekdayOf(iso));
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** "08:10" → 490. The value an `<input type="time">` gives. */
export function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function blocksOn(blocks: Block[], iso: string): Block[] {
  const weekday = weekdayOf(iso);
  return blocks
    .filter((block) => block.on_date === iso || block.weekday === weekday)
    .sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min);
}

function byDueTime(a: Task, b: Task): number {
  return (a.due_min ?? 1440) - (b.due_min ?? 1440) || a.title.localeCompare(b.title);
}

/** A task with no date waits on today, so it can't be lost; once done it leaves. */
export function tasksOn(tasks: Task[], iso: string, today: string): Task[] {
  return tasks
    .filter((task) => task.due_on === iso || (iso === today && task.due_on === null && !task.done_at))
    .sort(byDueTime);
}

export function overdueTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((task) => task.due_on !== null && task.due_on < today && !task.done_at)
    .sort((a, b) => (a.due_on as string).localeCompare(b.due_on as string) || byDueTime(a, b));
}

export function habitsOn(habits: Habit[], iso: string): Habit[] {
  const weekday = weekdayOf(iso);
  return habits.filter((habit) => habit.weekdays.includes(weekday));
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : null;
}

function title(value: unknown): string | null {
  const clean = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ") : value;
  const trimmed = text(clean, MAX_TITLE);
  return trimmed ? trimmed : null;
}

function minutes(value: unknown, low: number, high: number): number | null {
  return Number.isInteger(value) && (value as number) >= low && (value as number) <= high
    ? (value as number)
    : null;
}

function blockValues(raw: Record<string, unknown>) {
  const name = title(raw.title);
  const location = text(raw.location ?? "", MAX_LOCATION);
  const notes = text(raw.notes ?? "", MAX_NOTES);
  const start = minutes(raw.start_min, 0, 1439);
  const end = minutes(raw.end_min, 1, 1440);
  const weekday = raw.weekday == null ? null : minutes(raw.weekday, 1, 7);
  const onDate = raw.on_date == null ? null : isDate(raw.on_date) ? raw.on_date : null;
  if (!name || location === null || notes === null || start === null || end === null) return null;
  if (end <= start || (weekday === null) === (onDate === null)) return null;
  return {
    title: name,
    weekday,
    on_date: onDate,
    start_min: start,
    end_min: end,
    location,
    notes,
    shareable: raw.shareable === true,
  };
}

function taskValues(raw: Record<string, unknown>) {
  const name = title(raw.title);
  const notes = text(raw.notes ?? "", MAX_NOTES);
  const dueOn = raw.due_on == null || raw.due_on === "" ? null : isDate(raw.due_on) ? raw.due_on : undefined;
  const dueMin = raw.due_min == null ? null : minutes(raw.due_min, 0, 1439);
  if (!name || notes === null || dueOn === undefined) return null;
  if (raw.due_min != null && dueMin === null) return null;
  if (dueMin !== null && dueOn === null) return null;
  return {
    title: name,
    notes,
    due_on: dueOn,
    due_min: dueMin,
    shareable: raw.shareable === true,
  };
}

function habitValues(raw: Record<string, unknown>) {
  const name = title(raw.title);
  const days = raw.weekdays;
  if (!name || !Array.isArray(days) || days.length === 0) return null;
  if (!days.every((day) => minutes(day, 1, 7) !== null) || new Set(days).size !== days.length) {
    return null;
  }
  return { title: name, weekdays: [...days].sort((a, b) => a - b) as number[] };
}

/**
 * Only the fields a person edits ever reach the database. `source`, `done_at`
 * and `archived_at` are not in these lists, so a save can't set them.
 */
export function itemValues(kind: ItemKind, raw: Record<string, unknown>) {
  if (kind === "block") return blockValues(raw);
  if (kind === "task") return taskValues(raw);
  return habitValues(raw);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isKind(value: unknown): value is ItemKind {
  return value === "block" || value === "task" || value === "habit";
}

export type RoutineAction =
  | { action: "save"; kind: ItemKind; id: string | null; values: NonNullable<ReturnType<typeof itemValues>> }
  | { action: "archive"; kind: ItemKind; id: string }
  | { action: "done"; id: string; done: boolean }
  | { action: "reschedule"; ids: string[]; due_on: string }
  | { action: "check"; habit_id: string; on_date: string; checked: boolean }
  | { action: "log"; on_date: string; body: string }
  | { action: "undo"; change: number }
  | { action: "undo_note"; batch: string };

/** One request body from the organizer, or null when it can't be one. */
export function parseAction(body: unknown): RoutineAction | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  switch (raw.action) {
    case "save": {
      if (!isKind(raw.kind) || typeof raw.values !== "object" || raw.values === null) return null;
      if (raw.id != null && !isId(raw.id)) return null;
      const values = itemValues(raw.kind, raw.values as Record<string, unknown>);
      const id = (raw.id as string | null | undefined) ?? null;
      return values ? { action: "save", kind: raw.kind, id, values } : null;
    }
    case "archive":
      return isKind(raw.kind) && isId(raw.id)
        ? { action: "archive", kind: raw.kind, id: raw.id }
        : null;
    case "done":
      return isId(raw.id) && typeof raw.done === "boolean"
        ? { action: "done", id: raw.id, done: raw.done }
        : null;
    case "reschedule":
      return Array.isArray(raw.ids) &&
        raw.ids.length > 0 &&
        raw.ids.length <= 100 &&
        raw.ids.every(isId) &&
        isDate(raw.due_on)
        ? { action: "reschedule", ids: raw.ids, due_on: raw.due_on }
        : null;
    case "check":
      return isId(raw.habit_id) && isDate(raw.on_date) && typeof raw.checked === "boolean"
        ? { action: "check", habit_id: raw.habit_id, on_date: raw.on_date, checked: raw.checked }
        : null;
    case "log": {
      const logBody = text(raw.body, MAX_LOG);
      return isDate(raw.on_date) && logBody !== null
        ? { action: "log", on_date: raw.on_date, body: logBody }
        : null;
    }
    case "undo":
      return Number.isInteger(raw.change) && (raw.change as number) > 0
        ? { action: "undo", change: raw.change as number }
        : null;
    case "undo_note":
      return isId(raw.batch) ? { action: "undo_note", batch: raw.batch } : null;
    default:
      return null;
  }
}
