import { test } from "node:test";
import assert from "node:assert/strict";
import { overdueTasks, parseAction, tasksOn } from "./routine-model.ts";
import {
  applyAction,
  dataFor,
  emptyState,
  fullState,
  organizeNote,
  reviewWeek,
  scenarioFrom,
  sharedDays,
  statusFor,
} from "./routine-sample.ts";

const today = "2026-11-02";

function action(body: unknown) {
  const parsed = parseAction(body);
  assert.ok(parsed);
  return parsed;
}

test("an unknown scenario means the owner's page", () => {
  assert.equal(scenarioFrom("viewer"), "viewer");
  assert.equal(scenarioFrom("1"), "owner");
  assert.equal(scenarioFrom(null), "owner");
});

test("the full sample looks like the real page", () => {
  const state = fullState(today);
  assert.equal(overdueTasks(state.tasks, today).length, 11);
  assert.ok(state.tasks.length >= 78);
  assert.ok(tasksOn(state.tasks, today, today).length > 0);
  assert.ok(state.blocks.some((block) => block.on_date === today));
});

test("each scenario gives the page the role it expects", () => {
  const state = emptyState();
  assert.equal(statusFor(state, "owner").role, "owner");
  assert.equal(statusFor(state, "viewer").role, "viewer");
  assert.equal(statusFor(state, "visitor").role, "signedOut");
  assert.equal(statusFor(state, "request").role, "none");
  assert.equal(statusFor(state, "pending").role, "pending");
  assert.equal(statusFor(state, "denied").role, "denied");
  assert.equal(statusFor(state, "unverified").role, "unverified");
  assert.equal(statusFor(state, "unavailable").role, "unavailable");
});

test("sending the request form moves it to waiting", () => {
  const state = emptyState();
  state.requested = true;
  assert.equal(statusFor(state, "request").role, "pending");
});

test("a viewer's sample week is sanitized like the real one", () => {
  const [day] = sharedDays(fullState(today), today);
  assert.ok(day.blocks.some((block) => block.title === null));
  assert.ok(day.blocks.some((block) => block.title === "Dinner with family"));
  assert.equal(JSON.stringify(day).includes("Room 204"), false);
});

test("a tick shows in the history and can be undone", () => {
  const state = fullState(today);
  const [first] = state.tasks;
  assert.ok(applyAction(state, action({ action: "done", id: first.id, done: true })));
  assert.ok(first.done_at);

  const [change] = dataFor(state, today).changes;
  assert.equal(change.title, first.title);
  assert.ok(applyAction(state, action({ action: "undo", change: change.id })));
  assert.equal(first.done_at, null);
  assert.equal(dataFor(state, today).changes.length, 0);
});

test("adding, then undoing, leaves nothing behind", () => {
  const state = emptyState();
  const save = {
    action: "save",
    kind: "block",
    values: { title: "Study", on_date: today, start_min: 600, end_min: 660 },
  };
  assert.ok(applyAction(state, action(save)));
  assert.equal(state.blocks[0].title, "Study");
  assert.equal(state.blocks[0].start_min, 600);
  assert.ok(applyAction(state, action({ action: "undo", change: 1 })));
  assert.equal(state.blocks.length, 0);
});

test("removing and moving behave as they do for real", () => {
  const state = fullState(today);
  const overdue = overdueTasks(state.tasks, today);
  applyAction(state, action({ action: "reschedule", ids: overdue.map((task) => task.id), due_on: today }));
  assert.equal(overdueTasks(state.tasks, today).length, 0);

  const [block] = state.blocks;
  applyAction(state, action({ action: "archive", kind: "block", id: block.id }));
  assert.equal(state.blocks.includes(block), false);
});

test("a change to something missing is refused", () => {
  const id = "431a16d9-778b-40e8-9d2f-4cf73d2668a1";
  assert.equal(applyAction(emptyState(), action({ action: "done", id, done: true })), false);
});

test("the stand-in for Gemini shows every state of the note box", () => {
  const state = emptyState();
  assert.equal(organizeNote(state, "make an error", today).status, 422);
  assert.equal(organizeNote(state, "hit the limit", today).status, 429);

  const answered = organizeNote(state, "When am I free?", today).body as { batch: string | null };
  assert.equal(answered.batch, null);
  assert.equal(state.tasks.length, 0);

  const added = organizeNote(state, "Call the bank", today).body as { batch: string };
  assert.equal(state.tasks[0].source, "gemini");
  assert.ok(applyAction(state, action({ action: "undo_note", batch: added.batch })));
  assert.equal(state.tasks.length, 0);
});

test("a sample review is stored for its week", () => {
  const state = emptyState();
  reviewWeek(state, today);
  assert.ok(dataFor(state, today).review?.went_well.length);
  assert.equal(dataFor(state, "2026-11-09").review, null);
});
