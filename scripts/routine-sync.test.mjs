import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blocksFrom,
  cleanTitle,
  occurrences,
  parseOverrides,
  parseRule,
  staleBackups,
  tasksFrom,
} from "./routine-sync-lib.mjs";

const weekly = (day, until = "20261208T235959Z") =>
  `FREQ=WEEKLY;INTERVAL=1;UNTIL=${until};BYDAY=${day}`;

test("a series only falls on the days its rule names, even if it starts elsewhere", () => {
  // TMU's series begin on Tuesday Sep 8 whatever day the class is.
  const event = { start: "2026-09-08T11:00:00", rule: weekly("WE") };
  assert.deepEqual(occurrences(event, "2026-11-02", "2026-11-15"), ["2026-11-04", "2026-11-11"]);
});

test("a series stops at its UNTIL", () => {
  // Nov 4 at 04:59 UTC is still the evening of Nov 3 in Toronto.
  const event = { start: "2026-09-08T14:00:00", rule: weekly("WE", "20261104T045959Z") };
  assert.deepEqual(occurrences(event, "2026-10-26", "2026-11-15"), ["2026-10-28"]);
});

test("excluded dates are skipped, and every other week counts from the series", () => {
  const skipped = { start: "2026-10-05T14:00:00", rule: weekly("MO"), excluded: ["2026-10-12"] };
  assert.deepEqual(occurrences(skipped, "2026-10-05", "2026-10-19"), ["2026-10-05", "2026-10-19"]);

  const fortnight = { start: "2026-10-05T14:00:00", rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" };
  assert.deepEqual(occurrences(fortnight, "2026-10-05", "2026-10-26"), ["2026-10-05", "2026-10-19"]);
});

test("a rule it can't read is left out rather than guessed", () => {
  assert.equal(parseRule("FREQ=MONTHLY;BYDAY=1MO"), null);
  assert.equal(parseRule("FREQ=WEEKLY;COUNT=4;BYDAY=MO"), null);
  assert.deepEqual(occurrences({ start: "2026-10-05T14:00:00", rule: "FREQ=DAILY" }, "2026-10-05", "2026-10-09"), []);
});

test("a one-off event appears only inside the window", () => {
  const event = { start: "2026-11-18T18:00:00" };
  assert.deepEqual(occurrences(event, "2026-11-01", "2026-11-30"), ["2026-11-18"]);
  assert.deepEqual(occurrences(event, "2026-11-19", "2026-11-30"), []);
});

test("class titles lose their section, and other titles stay as written", () => {
  assert.equal(cleanTitle("CYS119 - 031 - LEC"), "CYS119 LEC");
  assert.equal(cleanTitle("MTH160 - 022 - LAB"), "MTH160 LAB");
  assert.equal(cleanTitle("Shift at work"), "Shift at work");
});

test("overlapping series give one block, and morning classes start ten minutes late", () => {
  const blocks = blocksFrom(
    [
      { title: "CYS151 - 011 - LEC", start: "2026-09-08T12:00:00", end: "2026-09-08T13:00:00", rule: weekly("FR"), tmu: true },
      { title: "CYS151 - 011 - LEC", start: "2026-10-23T12:00:00", end: "2026-10-23T13:00:00", rule: weekly("FR"), tmu: true, location: "DSQ 10" },
      { title: "MTH160 - 021 - LEC", start: "2026-09-08T08:00:00", end: "2026-09-08T11:00:00", rule: weekly("FR"), tmu: true },
    ],
    [],
    "2026-11-06",
    "2026-11-06"
  );
  assert.equal(blocks.length, 2);
  const noon = blocks.find((block) => block.title === "CYS151 LEC");
  assert.equal(noon.location, "DSQ 10");
  assert.equal(noon.start_min, 720);
  const morning = blocks.find((block) => block.title === "MTH160 LEC");
  assert.deepEqual([morning.start_min, morning.end_min], [490, 660]);
});

test("the ten-minute rule is for TMU's calendar only", () => {
  const [shift] = blocksFrom(
    [{ title: "Work", start: "2026-11-06T09:00:00", end: "2026-11-06T17:00:00" }],
    [],
    "2026-11-06",
    "2026-11-06"
  );
  assert.equal(shift.start_min, 540);
});

test("a class the vault's overrides hide never reaches the routine", () => {
  const overrides = parseOverrides(
    "# date\tmatch\taction\tsource\n2026-11-30\tCYS119 lab\thide\tLab 8 was the last\n"
  );
  const blocks = blocksFrom(
    [{ title: "CYS119 - 032 - LAB", start: "2026-09-14T14:00:00", end: "2026-09-14T16:00:00", rule: weekly("MO"), tmu: true }],
    overrides,
    "2026-11-23",
    "2026-12-07"
  );
  assert.deepEqual(blocks.map((block) => block.on_date), ["2026-11-23", "2026-12-07"]);
});

test("all-day and multi-day events are left out, and a late shift stops at midnight", () => {
  const blocks = blocksFrom(
    [
      { title: "Midterm this week", allDay: true, start: "2026-11-02T00:00:00", end: "2026-11-07T00:00:00" },
      { title: "Summit", start: "2026-11-02T09:00:00", end: "2026-11-03T21:00:00" },
      { title: "Night shift", start: "2026-11-02T20:00:00", end: "2026-11-03T02:00:00" },
    ],
    [],
    "2026-11-02",
    "2026-11-03"
  );
  assert.deepEqual(blocks.map((block) => [block.title, block.end_min]), [["Night shift", 1440]]);
});

test("Reminders keep a time only when one was set", () => {
  const tasks = tasksFrom([
    { id: "a", title: "[CYS119] Quiz 8", due: "2026-11-03T23:59:00" },
    { id: "b", title: "[CRM101] Read Ch 8", due: "2026-11-03T00:00:00" },
    { id: "c", title: "No date" },
    { id: "c", title: "Read twice" },
    { id: "d", title: "   " },
  ]);
  assert.deepEqual(tasks, [
    { key: "a", title: "[CYS119] Quiz 8", due_on: "2026-11-03", due_min: 1439 },
    { key: "b", title: "[CRM101] Read Ch 8", due_on: "2026-11-03", due_min: null },
    { key: "c", title: "No date", due_on: null, due_min: null },
  ]);
});

test("old backups go, and only the sync's own files are ever touched", () => {
  const names = ["routine-2026-10-30.json", "routine-2026-10-28.json", "routine-2026-10-29.json", "notes.txt"];
  assert.deepEqual(staleBackups(names, 2), ["routine-2026-10-28.json"]);
  assert.deepEqual(staleBackups(names, 3), []);
});

test("the backup holds the organizer, and none of the visitors' details", () => {
  const sql = readFileSync("supabase/migrations/20261031130000_routine_reviews.sql", "utf8");
  const code = sql.slice(sql.indexOf("create function public.routine_sync_backup"));
  assert.ok(code.indexOf("require_sync_token") < code.indexOf("jsonb_build_object"));
  assert.doesNotMatch(code, /access_|private\.owner|auth\./);
});

test("the sync reads titles and times only, and never opens the vault's notes", () => {
  const script = readFileSync("scripts/routine-sync.mjs", "utf8");
  assert.doesNotMatch(script, /Weekly\/|Daily\/|_Course|Courses\/|mail-/);
  assert.doesNotMatch(script, /body of|description of|Personal"/);
  assert.equal([...script.matchAll(/Documents\/Uni/g)].length, 1);
  assert.match(script, /overrides\.tsv/);
});

test("the Mac can't reach viewers, access or anything but its own three functions", () => {
  const sql = readFileSync("supabase/migrations/20261031120000_routine_sync.sql", "utf8");
  const code = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(code, /shareable|access_grants|access_requests|private\.owner/);
  const anon = code.slice(code.lastIndexOf("grant execute"), code.lastIndexOf("to anon"));
  const earlier = code.slice(0, code.lastIndexOf("grant execute"));
  const grant = earlier.slice(earlier.lastIndexOf("grant execute")) + anon;
  assert.deepEqual([...grant.matchAll(/routine_sync_\w+/g)].map(([name]) => name).sort(), [
    "routine_sync_closed",
    "routine_sync_push",
    "routine_sync_ticks",
  ]);
  for (const name of ["routine_sync_ticks", "routine_sync_closed", "routine_sync_push"]) {
    const body = code.slice(code.indexOf(`function public.${name}`));
    assert.ok(body.indexOf("require_sync_token") < body.indexOf("end;"), name);
  }
});
