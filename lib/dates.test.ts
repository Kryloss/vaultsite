import test from "node:test";
import assert from "node:assert/strict";
import { columnDate, numericDate, shortDate } from "./dates";

test("numericDate keeps the zeros, so every date is the same width", () => {
  assert.equal(numericDate("2026-09-06"), "06.09.2026");
  assert.equal(numericDate("2026-07-25"), "25.07.2026");
  assert.equal(numericDate("2026-09-06").length, numericDate("2026-11-25").length);
});

test("a value that is not a date is passed through, not mangled", () => {
  assert.equal(numericDate("soon"), "soon");
  assert.equal(shortDate("soon"), "soon");
});

test("a column in one year drops the year; a second year brings it back for every row", () => {
  const one = ["2026-09-06", "2026-08-06", undefined, "2026-07-25"];
  assert.equal(columnDate(one)("2026-09-06"), "06.09");

  const two = ["2027-01-03", "2026-09-06"];
  const format = columnDate(two);
  assert.deepEqual(two.map(format), ["03.01.2027", "06.09.2026"]);
});

test("an empty or undated column still formats", () => {
  assert.equal(columnDate([])("2026-09-06"), "06.09");
  assert.equal(columnDate([undefined])("2026-09-06"), "06.09");
});
