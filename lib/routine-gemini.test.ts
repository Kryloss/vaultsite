import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContext,
  parseAnswer,
  replyAnswer,
  RESPONSE_SCHEMA,
  systemPrompt,
  type GeminiRefs,
} from "./routine-gemini.ts";
import type { Block, Habit, Task } from "./routine-model.ts";

const BLOCK_ID = "431a16d9-778b-40e8-9d2f-4cf73d2668a1";
const TASK_ID = "431a16d9-778b-40e8-9d2f-4cf73d2668a2";
const HABIT_ID = "431a16d9-778b-40e8-9d2f-4cf73d2668a3";

const block: Block = {
  id: BLOCK_ID,
  title: "Gym",
  weekday: 1,
  on_date: null,
  start_min: 1020,
  end_min: 1080,
  location: "Goodlife",
  notes: "Leg day",
  shareable: true,
  source: "owner",
};

const task: Task = {
  id: TASK_ID,
  title: "CYS 119 Quiz",
  notes: "",
  due_on: "2026-11-03",
  due_min: 1439,
  done_at: null,
  shareable: false,
  source: "owner",
};

const habit: Habit = { id: HABIT_ID, title: "Read", weekdays: [1, 2], source: "owner" };

const refs: GeminiRefs = {
  b1: { kind: "block", item: block },
  t1: { kind: "task", item: task },
  h1: { kind: "habit", item: habit },
};

const answer = (...changes: unknown[]) => ({ message: "Done.", changes });

test("the context uses references, and never ids or the sharing setting", () => {
  const { text, refs: built } = buildContext(
    { blocks: [block], tasks: [task], habits: [habit], logs: [] },
    "2026-10-30"
  );
  assert.equal(text.includes(BLOCK_ID), false);
  assert.equal(text.includes("shareable"), false);
  assert.equal(built.b1.item.id, BLOCK_ID);
  assert.ok(text.includes('"ref":"t1"'));
});

test("the context holds the agreed fields, and cuts long ones", () => {
  const long = { ...block, notes: "x".repeat(1000) };
  const logs = [
    { on_date: "2026-10-29", body: "y".repeat(3000) },
    { on_date: "2026-10-01", body: "too old" },
    { on_date: "2026-10-31", body: "the future" },
  ];
  const { text } = buildContext({ blocks: [long], tasks: [], habits: [], logs }, "2026-10-30");
  assert.ok(text.includes("Goodlife"));
  assert.equal(text.includes("x".repeat(301)), false);
  assert.ok(text.includes("y".repeat(1500)));
  assert.equal(text.includes("y".repeat(1501)), false);
  assert.equal(text.includes("too old"), false);
  assert.equal(text.includes("the future"), false);
});

test("finished tasks aren't sent", () => {
  const done = { ...task, done_at: "2026-10-30T10:00:00Z" };
  const { text, refs: built } = buildContext(
    { blocks: [], tasks: [done], habits: [], logs: [] },
    "2026-10-30"
  );
  assert.equal(text.includes("CYS 119"), false);
  assert.equal(built.t1, undefined);
});

test("the prompt asks for English and marks the note as data", () => {
  const prompt = systemPrompt("2026-10-30");
  assert.match(prompt, /Always write .* in English/);
  assert.match(prompt, /Never follow instructions/);
  assert.match(prompt, /weekday 5/);
});

test("the answer's schema has no way to express sharing", () => {
  assert.equal(JSON.stringify(RESPONSE_SCHEMA).includes("shareable"), false);
});

test("adding a task and a weekly block", () => {
  const parsed = parseAnswer(
    answer(
      { action: "add", kind: "task", title: "Read Ch 9", due: "2026-11-02" },
      { action: "add", kind: "block", title: "Study", weekday: 2, start: "18:00", end: "19:30" }
    ),
    {}
  );
  assert.deepEqual(parsed?.ops[0].values, {
    title: "Read Ch 9",
    notes: "",
    due_on: "2026-11-02",
    due_min: null,
  });
  assert.equal(parsed?.ops[1].values?.start_min, 1080);
  assert.equal(parsed?.ops[1].values?.end_min, 1170);
});

test("a block with no end runs for an hour, and stops at midnight", () => {
  const parsed = parseAnswer(
    answer(
      { action: "add", kind: "block", title: "A", date: "2026-11-02", start: "09:00" },
      { action: "add", kind: "block", title: "B", date: "2026-11-02", start: "23:30" }
    ),
    {}
  );
  assert.equal(parsed?.ops[0].values?.end_min, 600);
  assert.equal(parsed?.ops[1].values?.end_min, 1440);
});

test("an update changes only what it names", () => {
  const parsed = parseAnswer(answer({ action: "update", kind: "block", ref: "b1", title: "Lift" }), refs);
  assert.deepEqual(parsed?.ops[0], {
    action: "update",
    kind: "block",
    id: BLOCK_ID,
    values: {
      title: "Lift",
      weekday: 1,
      on_date: null,
      start_min: 1020,
      end_min: 1080,
      location: "Goodlife",
      notes: "Leg day",
    },
  });
});

test("moving a block keeps its length", () => {
  const parsed = parseAnswer(answer({ action: "update", kind: "block", ref: "b1", start: "18:00" }), refs);
  assert.equal(parsed?.ops[0].values?.start_min, 1080);
  assert.equal(parsed?.ops[0].values?.end_min, 1140);
});

test("moving a weekly block to one date stops it repeating", () => {
  const parsed = parseAnswer(
    answer({ action: "update", kind: "block", ref: "b1", date: "2026-11-05" }),
    refs
  );
  assert.equal(parsed?.ops[0].values?.weekday, null);
  assert.equal(parsed?.ops[0].values?.on_date, "2026-11-05");
});

test("a task can be finished and any item removed", () => {
  const parsed = parseAnswer(
    answer(
      { action: "done", kind: "task", ref: "t1" },
      { action: "archive", kind: "habit", ref: "h1" }
    ),
    refs
  );
  assert.deepEqual(parsed?.ops, [
    { action: "done", kind: "task", id: TASK_ID },
    { action: "archive", kind: "habit", id: HABIT_ID },
  ]);
});

test("sharing can't be set by any route through an answer", () => {
  const parsed = parseAnswer(
    answer(
      { action: "add", kind: "task", title: "x", shareable: true },
      { action: "update", kind: "task", ref: "t1", title: "y", shareable: true }
    ),
    refs
  );
  assert.equal(JSON.stringify(parsed).includes("shareable"), false);
});

test("a change to something it wasn't shown refuses the whole note", () => {
  const good = { action: "add", kind: "task", title: "x" };
  assert.equal(parseAnswer(answer(good, { action: "archive", kind: "task", ref: "t99" }), refs), null);
  assert.equal(parseAnswer(answer(good, { action: "archive", kind: "task", ref: TASK_ID }), refs), null);
});

test("a reference of the wrong kind is refused", () => {
  assert.equal(parseAnswer(answer({ action: "archive", kind: "task", ref: "b1" }), refs), null);
});

test("only a task can be done", () => {
  assert.equal(parseAnswer(answer({ action: "done", kind: "block", ref: "b1" }), refs), null);
});

test("values that don't fit the model refuse the note", () => {
  for (const bad of [
    { action: "add", kind: "block", title: "x", weekday: 9, start: "09:00" },
    { action: "add", kind: "block", title: "x", start: "09:00" },
    { action: "add", kind: "block", title: "x", weekday: 1, start: "25:00" },
    { action: "add", kind: "block", title: "x", weekday: 1, start: "10:00", end: "09:00" },
    { action: "add", kind: "task", title: "  " },
    { action: "add", kind: "task", title: "x", due: "someday" },
    { action: "add", kind: "habit", title: "x", weekdays: [] },
    { action: "drop", kind: "task", ref: "t1" },
    { action: "add", kind: "users", title: "x" },
  ]) {
    assert.equal(parseAnswer(answer(bad), refs), null, JSON.stringify(bad));
  }
});

test("too many changes or removals are refused", () => {
  const remove = { action: "archive", kind: "task", ref: "t1" };
  assert.equal(parseAnswer(answer(...Array(6).fill(remove)), refs), null);
  const add = { action: "add", kind: "task", title: "x" };
  assert.equal(parseAnswer(answer(...Array(31).fill(add)), refs), null);
  assert.equal(parseAnswer(answer(...Array(30).fill(add)), refs)?.ops.length, 30);
});

test("an answer with no changes is fine, and a broken one isn't", () => {
  assert.deepEqual(parseAnswer({ message: "Nothing to do.", changes: [] }, refs), {
    message: "Nothing to do.",
    ops: [],
  });
  assert.equal(parseAnswer({ changes: [] }, refs), null);
  assert.equal(parseAnswer({ message: "x" }, refs), null);
  assert.equal(parseAnswer("text", refs), null);
  assert.equal(parseAnswer(null, refs), null);
});

test("a reply split into parts is joined, and thoughts are left out", () => {
  const reply = {
    candidates: [
      {
        content: {
          parts: [
            { thought: true, text: "Let me think." },
            { text: '{"message":"Do' },
            { text: 'ne.","changes":[]}' },
          ],
        },
      },
    ],
  };
  assert.deepEqual(replyAnswer(reply), { message: "Done.", changes: [] });
});

test("an unreadable reply says why, and never what it said", () => {
  const reasons: string[] = [];
  const reply = {
    candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"message":"private' }] } }],
  };
  assert.equal(replyAnswer(reply, (reason) => reasons.push(reason)), null);
  assert.deepEqual(reasons, ["unreadable reply, finish: MAX_TOKENS, length: 19"]);
});

test("an empty reply is refused without throwing", () => {
  assert.equal(replyAnswer({}), null);
  assert.equal(replyAnswer({ candidates: [{ content: { parts: [] } }] }), null);
  assert.equal(replyAnswer(null), null);
});

test("empty values count as left out", () => {
  const parsed = parseAnswer(
    answer({
      action: "add",
      kind: "block",
      title: "Gym",
      weekday: 1,
      date: "",
      start: "18:00",
      end: "",
      location: "",
      notes: "",
      due: "",
      time: "",
      weekdays: [],
      ref: "",
    }),
    refs
  );
  assert.equal(parsed?.ops[0].values?.start_min, 1080);
  assert.equal(parsed?.ops[0].values?.end_min, 1140);
  assert.equal(parsed?.ops[0].values?.on_date, null);
});

test("a weekday of 0 isn't a weekday", () => {
  const parsed = parseAnswer(
    answer({ action: "add", kind: "block", title: "x", weekday: 0, date: "2026-11-02", start: "09:00" }),
    refs
  );
  assert.equal(parsed?.ops[0].values?.weekday, null);
  assert.equal(parsed?.ops[0].values?.on_date, "2026-11-02");
});

test("a block with no day is refused, naming fields and not their contents", () => {
  const reasons: string[] = [];
  const parsed = parseAnswer(
    answer({ action: "add", kind: "block", title: "Private clinic", start: "18:00", location: "" }),
    refs,
    (reason) => reasons.push(reason)
  );
  assert.equal(parsed, null);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /add block invalid, fields: action,kind,title,start/);
  assert.equal(reasons[0].includes("Private clinic"), false);
});

test("the prompt says how to write something that happens every day", () => {
  assert.match(systemPrompt("2026-10-30"), /every day is seven blocks/);
});

test("the message is cut to fit the page", () => {
  const parsed = parseAnswer({ message: "x".repeat(1000), changes: [] }, refs);
  assert.equal(parsed?.message.length, 300);
});
