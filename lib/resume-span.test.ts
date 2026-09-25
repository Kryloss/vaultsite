/**
 * Run with `npm test`. Covers the Now page's timeline chart (lib/resume-span.ts),
 * which reads free-text résumé periods — the shapes below are the ones the
 * vault actually uses, plus the ones it must refuse rather than guess.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chartRange, parseSpan } from "./resume-span.ts";

const m = (year: number, month: number) => year * 12 + month;

test("month-year ranges, with any dash", () => {
  assert.deepEqual(parseSpan("Oct 2023 — Oct 2025"), { start: m(2023, 9), end: m(2025, 9) });
  assert.deepEqual(parseSpan("Jan 2026 - Jul 2026"), { start: m(2026, 0), end: m(2026, 6) });
  assert.deepEqual(parseSpan("September 2019 – June 2020"), { start: m(2019, 8), end: m(2020, 5) });
});

test("open-ended periods have no end", () => {
  assert.deepEqual(parseSpan("Oct 2025 — present"), { start: m(2025, 9), end: null });
  assert.deepEqual(parseSpan("From Sept 2026"), { start: m(2026, 8), end: null });
  assert.deepEqual(parseSpan("Since 2022"), { start: m(2022, 0), end: null });
});

test("a bare year ends mid-year, so a school year doesn't overlap the autumn", () => {
  assert.deepEqual(parseSpan("2022 — 2026"), { start: m(2022, 0), end: m(2026, 5) });
});

test("anything else is left off the chart", () => {
  assert.equal(parseSpan("In progress"), null);
  assert.equal(parseSpan(undefined), null);
  assert.equal(parseSpan("Oct 2025 — Mar 2024"), null);
  assert.equal(parseSpan("Smarch 2025 — present"), null);
});

test("the range runs whole years, past today", () => {
  const spans = [parseSpan("2022 — 2026")!, parseSpan("Oct 2025 — present")!];
  assert.deepEqual(chartRange(spans, m(2026, 8)), { from: m(2022, 0), to: m(2027, 0) });
  assert.equal(chartRange([], m(2026, 8)), null);
});
