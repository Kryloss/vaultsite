import { test } from "node:test";
import assert from "node:assert/strict";
import { nthWeekday, observance, observanceKind } from "@/lib/observances";

/** Local-time date, since observance() reads local calendar components. */
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

test("names the fixed celebrations", () => {
  assert.equal(observance(on(2026, 8, 24)), "independence");
  assert.equal(observance(on(2026, 8, 23)), "flag");
  assert.equal(observance(on(2026, 1, 22)), "unity");
  assert.equal(observance(on(2026, 6, 28)), "constitution");
  assert.equal(observance(on(2026, 10, 1)), "defenders");
  assert.equal(observance(on(2026, 11, 21)), "dignity");
  assert.equal(observance(on(2026, 12, 6)), "armedForces");
});

test("names the fixed days of remembrance", () => {
  assert.equal(observance(on(2026, 2, 20)), "heavenlyHundred");
  assert.equal(observance(on(2026, 2, 24)), "invasion");
  assert.equal(observance(on(2026, 4, 26)), "chornobyl");
  assert.equal(observance(on(2026, 5, 8)), "victoryOverNazism");
  assert.equal(observance(on(2026, 6, 22)), "mourning");
  assert.equal(observance(on(2026, 8, 29)), "fallenDefenders");
});

test("an ordinary day is not an observance", () => {
  assert.equal(observance(on(2026, 8, 25)), null);
  assert.equal(observance(on(2026, 3, 14)), null);
  // A day number must not match on its own, in the wrong month.
  assert.equal(observance(on(2026, 7, 24)), null);
  assert.equal(observance(on(2026, 3, 22)), null);
});

test("the flag is for celebrations and never for mourning", () => {
  for (const id of ["independence", "flag", "vyshyvanka", "unity"] as const) {
    assert.equal(observanceKind[id], "celebration", id);
  }
  for (const id of ["holodomor", "invasion", "heavenlyHundred", "mourning"] as const) {
    assert.equal(observanceKind[id], "remembrance", id);
  }
});

test("Vyshyvanka Day is the third Thursday of May", () => {
  // 1 May 2025 is a Thursday, so the third one is the 15th.
  assert.equal(nthWeekday(2025, 4, 4, 3), 15);
  // 1 May 2026 is a Friday: first Thursday the 7th, third the 21st.
  assert.equal(nthWeekday(2026, 4, 4, 3), 21);
  assert.equal(observance(on(2026, 5, 21)), "vyshyvanka");
  assert.equal(observance(on(2026, 5, 14)), null);
  for (const year of [2025, 2026, 2027, 2030, 2033]) {
    const d = nthWeekday(year, 4, 4, 3);
    assert.equal(new Date(Date.UTC(year, 4, d)).getUTCDay(), 4, `${year} is not a Thursday`);
    assert.ok(d >= 15 && d <= 21, `${year}: ${d} is not the third week`);
  }
});

test("Holodomor Remembrance Day is the fourth Saturday of November", () => {
  // 1 Nov 2025 is a Saturday, so the fourth one is the 22nd.
  assert.equal(nthWeekday(2025, 10, 6, 4), 22);
  assert.equal(observance(on(2025, 11, 22)), "holodomor");
  // 2026: 1 Nov is a Sunday, first Saturday the 7th, fourth the 28th.
  assert.equal(observance(on(2026, 11, 28)), "holodomor");
  assert.equal(observance(on(2026, 11, 21)), "dignity"); // and not the wrong one
  for (const year of [2025, 2026, 2027, 2030, 2033]) {
    const d = nthWeekday(year, 10, 6, 4);
    assert.equal(new Date(Date.UTC(year, 10, d)).getUTCDay(), 6, `${year} is not a Saturday`);
    assert.ok(d >= 22 && d <= 28, `${year}: ${d} is not the fourth week`);
    // It must never collide with Dignity and Freedom Day on the 21st.
    assert.notEqual(d, 21);
  }
});
