/**
 * Run with `npm test`. Covers the Now page's "· 2 months ago" (lib/freshness.ts),
 * which reads a free-text frontmatter field the vault can only exercise on
 * whatever month it happens to say today.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessLabel, monthsSince, parseMonthYear } from "./freshness.ts";

test("reads 'Month YYYY' in any case, and nothing else", () => {
  assert.deepEqual(parseMonthYear("July 2026"), { year: 2026, month: 6 });
  assert.deepEqual(parseMonthYear(" january 2027 "), { year: 2027, month: 0 });
  assert.equal(parseMonthYear("липень 2026"), null);
  assert.equal(parseMonthYear("2026-07"), null);
  assert.equal(parseMonthYear("Julember 2026"), null);
});

test("counts calendar months, across a year boundary", () => {
  assert.equal(monthsSince("July 2026", new Date(2026, 6, 31)), 0);
  assert.equal(monthsSince("July 2026", new Date(2026, 8, 24)), 2);
  assert.equal(monthsSince("December 2026", new Date(2027, 0, 1)), 1);
});

test("a month still to come, or an unreadable one, says nothing", () => {
  assert.equal(monthsSince("October 2026", new Date(2026, 8, 24)), null);
  assert.equal(monthsSince("soon", new Date(2026, 8, 24)), null);
});

test("labels read naturally in both languages", () => {
  assert.deepEqual(freshnessLabel(0), { en: "this month", uk: "цього місяця" });
  assert.deepEqual(freshnessLabel(1), { en: "last month", uk: "минулого місяця" });
  assert.deepEqual(freshnessLabel(2), { en: "2 months ago", uk: "2 місяці тому" });
  assert.deepEqual(freshnessLabel(5), { en: "5 months ago", uk: "5 місяців тому" });
  assert.deepEqual(freshnessLabel(11), { en: "11 months ago", uk: "11 місяців тому" });
  assert.deepEqual(freshnessLabel(12), { en: "a year ago", uk: "рік тому" });
  assert.deepEqual(freshnessLabel(25), { en: "2 years ago", uk: "2 роки тому" });
  assert.deepEqual(freshnessLabel(60), { en: "5 years ago", uk: "5 років тому" });
});
