/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers SpongeBob's levitation on /music (lib/levitation.ts). None of this is
 * visible on a built page until it is wrong, and then only as an iPod that
 * swings the wrong way, a figure that drifts off the edge of the window, or a
 * float that turns at the same depth every time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEEL,
  STEP,
  advance,
  forkOffset,
  pose,
  rotate,
  start,
  step,
  type LevitationParams,
} from "./levitation.ts";

/** The geometry at 1400px: his fork, the cord's length, 426px to sink. */
const params: LevitationParams = {
  range: 426,
  fork: { x: -57, y: 70 },
  length: 228,
  room: { left: 32, right: 24 },
};

/** Random draws that ask for nothing: no move, no lean, no gust. */
const calm: LevitationParams = { ...params, range: 0, room: { left: 0, right: 0 } };
const half = () => 0.5;

/** A repeatable stand-in for Math.random. */
function seeded(seed = 7) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

const deg = (rad: number) => (rad * 180) / Math.PI;

test("rotate() turns the way CSS does: clockwise on screen, y down", () => {
  const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
  assert.ok(Math.abs(r.x) < 1e-12 && Math.abs(r.y - 1) < 1e-12);
});

test("at rest the fork is where the picture put it", () => {
  const s = start(params, half);
  assert.deepEqual(forkOffset(s, params), { x: 0, y: 0 });
});

test("he starts where the page drew him, so hydration never jumps", () => {
  const s = start(params, seeded());
  assert.equal(s.y, 0);
  assert.equal(s.x, 0);
  assert.equal(s.lean, 0);
});

test("a still fork leaves a hanging iPod hanging", () => {
  const s = start(calm, half);
  for (let i = 0; i < 10 / STEP; i++) step(s, calm, half);
  assert.ok(Math.abs(s.swing) < 1e-9, `swung to ${deg(s.swing)}°`);
});

test("let go off plumb, the iPod swings at its period and dies away", () => {
  const s = start(calm, half, 0.05);
  const crossings: number[] = [];
  let before = s.swing;
  while (s.t < 4.5) {
    step(s, calm, half);
    if (before > 0 && s.swing <= 0) crossings.push(s.t);
    before = s.swing;
  }
  const period = crossings[1] - crossings[0];
  assert.ok(Math.abs(period - FEEL.swingPeriod) < 0.05, `period ${period}s`);

  // Half its reach gone in about 4.5s: e^(−0.15 × 4.5) ≈ 0.51.
  let reach = 0;
  const until = s.t + FEEL.swingPeriod;
  while (s.t < until) {
    step(s, calm, half);
    reach = Math.max(reach, Math.abs(s.swing));
  }
  assert.ok(reach > 0.05 * 0.4 && reach < 0.05 * 0.6, `reach ${reach / 0.05}`);
});

test("pushed right, he leaves the iPod behind: it swings LEFT first", () => {
  const s = start({ ...params, room: { left: 500, right: 500 } }, half);
  s.gust = { at: 0, for: FEEL.gustLength, force: 300 };
  s.retargetAt = Infinity;
  while (s.t < 0.35) step(s, params, half);
  assert.ok(s.x > 0, "he moved right");
  assert.ok(s.swing < 0, `the iPod went ${deg(s.swing)}°`);
});

test("over ten minutes he keeps to his range and his room", () => {
  const random = seeded(11);
  const s = start(params, random);
  let low = 0;
  let high = 0;
  let side = { left: 0, right: 0 };
  let swing = 0;
  while (s.t < 600) {
    step(s, params, random);
    const p = pose(s);
    low = Math.max(low, p.y);
    high = Math.min(high, p.y);
    side = { left: Math.max(side.left, -p.x), right: Math.max(side.right, p.x) };
    swing = Math.max(swing, Math.abs(s.swing));
  }
  // The float's overshoot stays inside the margin; the shimmer rides on top.
  assert.ok(low <= params.range + FEEL.shimmer, `sank ${low} of ${params.range}`);
  assert.ok(low > params.range * 0.8, `only ever sank ${low}`);
  assert.ok(high >= -FEEL.shimmer - 1, `rose ${-high} above rest`);
  assert.ok(side.left <= params.room.left, `drifted ${side.left} left`);
  assert.ok(side.right <= params.room.right, `drifted ${side.right} right`);
  // A real swing, but a hanging one.
  assert.ok(deg(swing) > 3 && deg(swing) < 15, `swung ${deg(swing)}°`);
});

test("his dips and rises turn at a different depth every time", () => {
  const random = seeded(3);
  const s = start(params, random);
  const turns: number[] = [];
  let before = 0;
  while (s.t < 600) {
    step(s, params, random);
    if (before > 0 && s.vy <= 0) turns.push(Math.round(s.y));
    before = s.vy;
  }
  assert.ok(turns.length > 40, `${turns.length} turns`);
  const distinct = new Set(turns).size;
  assert.ok(distinct >= turns.length * 0.9, `${distinct} of ${turns.length}`);
});

test("a gust carries him no further than gustReach per px/s of kick", () => {
  const roomy = { ...params, room: { left: 1000, right: 1000 } };
  for (const kick of FEEL.gustKick) {
    const s = start(roomy, half);
    s.retargetAt = Infinity;
    s.gust = { at: 0, for: FEEL.gustLength, force: (2 * kick) / FEEL.gustLength };
    let far = 0;
    while (s.t < 6) {
      step(s, roomy, half);
      far = Math.max(far, s.x);
    }
    assert.ok(far <= FEEL.gustReach * kick, `${far}px for ${kick}px/s`);
  }
});

test("a long gap is cut short, not replayed", () => {
  const s = start(params, seeded());
  const left = advance(s, params, seeded(), 30);
  assert.ok(s.t <= 0.5 + 1e-9, `ran ${s.t}s`);
  assert.ok(left >= 0 && left < STEP);
});
