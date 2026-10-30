import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  blocksOn,
  formatTime,
  habitsOn,
  isDate,
  itemValues,
  localDate,
  overdueTasks,
  parseAction,
  parseTime,
  tasksOn,
  weekdayOf,
  weekStart,
  type Block,
  type Task,
} from "./routine-model.ts";
import { overdueCount } from "./plural.ts";

const ID = "431a16d9-778b-40e8-9d2f-4cf73d2668a2";

function block(over: Partial<Block>): Block {
  return {
    id: ID,
    title: "x",
    weekday: null,
    on_date: null,
    start_min: 0,
    end_min: 60,
    location: "",
    notes: "",
    shareable: false,
    source: "owner",
    ...over,
  };
}

function task(over: Partial<Task>): Task {
  return {
    id: ID,
    title: "x",
    notes: "",
    due_on: null,
    due_min: null,
    done_at: null,
    shareable: false,
    source: "owner",
    ...over,
  };
}

test("weekdays are ISO: Monday is 1 and Sunday is 7", () => {
  assert.equal(weekdayOf("2026-11-02"), 1);
  assert.equal(weekdayOf("2026-11-08"), 7);
});

test("a week starts on Monday, including from a Sunday", () => {
  assert.equal(weekStart("2026-11-08"), "2026-11-02");
  assert.equal(weekStart("2026-11-02"), "2026-11-02");
});

test("adding days crosses a month and the clock change", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  // Clocks go back in Ontario on 2026-11-01; a date must not slip.
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
});

test("localDate reads the reader's calendar, not UTC", () => {
  assert.equal(localDate(new Date(2026, 9, 30, 23, 30)), "2026-10-30");
  assert.equal(localDate(new Date(2026, 0, 5, 0, 10)), "2026-01-05");
});

test("isDate refuses a date that doesn't exist", () => {
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(isDate("2026-1-1"), false);
  assert.equal(isDate(20261030), false);
});

test("times round trip, and bad ones are refused", () => {
  assert.equal(formatTime(490), "08:10");
  assert.equal(parseTime("08:10"), 490);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("8:10"), null);
  assert.equal(parseTime(""), null);
});

test("a day holds its weekly blocks and its dated ones, in time order", () => {
  const blocks = [
    block({ id: "late", weekday: 5, start_min: 720, end_min: 780 }),
    block({ id: "dated", on_date: "2026-10-30", start_min: 60, end_min: 120 }),
    block({ id: "other", weekday: 1 }),
  ];
  assert.deepEqual(blocksOn(blocks, "2026-10-30").map((b) => b.id), ["dated", "late"]);
});

test("undated tasks wait on today only, and leave once done", () => {
  const tasks = [
    task({ id: "undated" }),
    task({ id: "finished", done_at: "2026-10-30T10:00:00Z" }),
    task({ id: "due", due_on: "2026-10-31" }),
  ];
  assert.deepEqual(tasksOn(tasks, "2026-10-30", "2026-10-30").map((t) => t.id), ["undated"]);
  assert.deepEqual(tasksOn(tasks, "2026-10-31", "2026-10-30").map((t) => t.id), ["due"]);
});

test("a finished task stays visible on the day it was due", () => {
  const tasks = [task({ id: "done", due_on: "2026-10-30", done_at: "2026-10-30T10:00:00Z" })];
  assert.deepEqual(tasksOn(tasks, "2026-10-30", "2026-10-30").map((t) => t.id), ["done"]);
});

test("overdue means past, unfinished and dated, oldest first", () => {
  const tasks = [
    task({ id: "newer", due_on: "2026-10-29" }),
    task({ id: "older", due_on: "2026-10-20" }),
    task({ id: "today", due_on: "2026-10-30" }),
    task({ id: "done", due_on: "2026-10-01", done_at: "2026-10-01T10:00:00Z" }),
    task({ id: "undated" }),
  ];
  assert.deepEqual(overdueTasks(tasks, "2026-10-30").map((t) => t.id), ["older", "newer"]);
});

test("a habit appears on its own weekdays", () => {
  const habits = [
    { id: "weekday", title: "x", weekdays: [1, 2, 3, 4, 5], source: "owner" },
    { id: "sunday", title: "x", weekdays: [7], source: "owner" },
  ];
  assert.deepEqual(habitsOn(habits, "2026-11-08").map((h) => h.id), ["sunday"]);
});

test("a block repeats weekly or falls on a date, never both or neither", () => {
  const base = { title: "x", start_min: 60, end_min: 120 };
  assert.ok(itemValues("block", { ...base, weekday: 3 }));
  assert.ok(itemValues("block", { ...base, on_date: "2026-11-01" }));
  assert.equal(itemValues("block", base), null);
  assert.equal(itemValues("block", { ...base, weekday: 3, on_date: "2026-11-01" }), null);
});

test("a block has to end after it starts", () => {
  assert.equal(itemValues("block", { title: "x", weekday: 1, start_min: 120, end_min: 120 }), null);
  assert.equal(itemValues("block", { title: "x", weekday: 1, start_min: -1, end_min: 120 }), null);
  assert.ok(itemValues("block", { title: "x", weekday: 1, start_min: 0, end_min: 1440 }));
});

test("a save can't set source, done_at or archived_at", () => {
  const values = itemValues("task", {
    title: "x",
    source: "uni",
    source_key: "k",
    done_at: "2026-10-30T10:00:00Z",
    archived_at: "2026-10-30T10:00:00Z",
    id: ID,
  });
  assert.deepEqual(values, { title: "x", notes: "", due_on: null, due_min: null, shareable: false });
});

test("shareable has to be exactly true, so anything else stays private", () => {
  const shareable = (value: unknown) =>
    (itemValues("task", { title: "x", shareable: value }) as { shareable: boolean }).shareable;
  assert.equal(shareable("true"), false);
  assert.equal(shareable(1), false);
  assert.equal(shareable(true), true);
});

test("a task needs a date before it can have a time", () => {
  assert.equal(itemValues("task", { title: "x", due_min: 60 }), null);
  assert.ok(itemValues("task", { title: "x", due_on: "2026-11-01", due_min: 60 }));
});

test("titles lose control characters and can't be blank or oversized", () => {
  assert.equal(itemValues("habit", { title: "   ", weekdays: [1] }), null);
  assert.equal(itemValues("habit", { title: "x".repeat(201), weekdays: [1] }), null);
  assert.equal(itemValues("task", { title: "one\ntwo" })?.title, "one two");
});

test("a habit needs real, distinct weekdays, and they come back sorted", () => {
  assert.equal(itemValues("habit", { title: "x", weekdays: [] }), null);
  assert.equal(itemValues("habit", { title: "x", weekdays: [8] }), null);
  assert.equal(itemValues("habit", { title: "x", weekdays: [1, 1] }), null);
  assert.deepEqual(itemValues("habit", { title: "x", weekdays: [3, 1] }), {
    title: "x",
    weekdays: [1, 3],
  });
});

test("every action parses, and malformed ones are refused", () => {
  assert.deepEqual(parseAction({ action: "done", id: ID, done: true }), {
    action: "done",
    id: ID,
    done: true,
  });
  assert.equal(parseAction({ action: "done", id: "1 or 1=1", done: true }), null);
  assert.equal(parseAction({ action: "archive", kind: "users", id: ID }), null);
  assert.equal(parseAction({ action: "undo", change: "7" }), null);
  assert.equal(parseAction({ action: "reschedule", ids: [], due_on: "2026-11-01" }), null);
  assert.equal(parseAction({ action: "drop" }), null);
  assert.equal(parseAction(null), null);
});

test("a log can be emptied, and can't exceed its limit", () => {
  assert.deepEqual(parseAction({ action: "log", on_date: "2026-10-30", body: "" }), {
    action: "log",
    on_date: "2026-10-30",
    body: "",
  });
  assert.equal(parseAction({ action: "log", on_date: "2026-10-30", body: "x".repeat(5001) }), null);
});

test("overdueCount declines in both languages", () => {
  assert.deepEqual(overdueCount(1), { en: "1 overdue", uk: "1 прострочене" });
  assert.deepEqual(overdueCount(3), { en: "3 overdue", uk: "3 прострочені" });
  assert.deepEqual(overdueCount(11), { en: "11 overdue", uk: "11 прострочених" });
});
