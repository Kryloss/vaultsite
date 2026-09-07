/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers the mascot's size ramp (lib/mascot.ts). Worth testing because the
 * failure is silent and only visible at one size: the eyes are strokes cut out
 * of a fill, so if the ramp ever runs the wrong way the character keeps its
 * silhouette and quietly loses its face in the sidebar while looking perfect
 * on the home page.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DETAIL_MIN,
  EYE,
  eyePath,
  mascotGeometry,
  mascotInner,
  mascotSvg,
  replaceFinalStop,
} from "./mascot.ts";

test("the eyes thicken as the drawing shrinks, and never the other way", () => {
  const sizes = [96, 64, 56, 48, 40, 32, 24, 16, 12, 8];
  for (let i = 1; i < sizes.length; i++) {
    const bigger = mascotGeometry(sizes[i - 1]);
    const smaller = mascotGeometry(sizes[i]);
    assert.ok(
      smaller.eyeStroke >= bigger.eyeStroke,
      `${sizes[i]}px has thinner eyes than ${sizes[i - 1]}px`
    );
    assert.ok(
      smaller.eyeDepth >= bigger.eyeDepth,
      `${sizes[i]}px has shallower eyes than ${sizes[i - 1]}px`
    );
  }
});

test("the mouth, its line and the ring appear at DETAIL_MIN and not below", () => {
  assert.equal(mascotGeometry(DETAIL_MIN).detail, true);
  assert.equal(mascotGeometry(DETAIL_MIN - 1).detail, false);
  assert.equal(mascotGeometry(64).detail, true);
  assert.equal(mascotGeometry(16).detail, false);
});

test("a nonsense size degrades to the smallest drawing, never throws", () => {
  for (const bad of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
    const g = mascotGeometry(bad);
    assert.equal(g.detail, false, `${bad} should not draw detail`);
    assert.ok(g.eyeStroke > 0 && g.eyeDepth > 0, `${bad} produced no eyes`);
  }
});

test("an eye is a quadratic whose ends sit on the baseline it was given", () => {
  // The ends carry the y it was handed; only the control point lifts. If this
  // ever drifts the two eyes stop sitting on one line, which reads as a squint.
  assert.equal(eyePath(18.25, 36.5, 6.5), "M18.25 36.5q4.75 -6.5 9.5 0");
  assert.equal(eyePath(36.25, 36.5, 7.5), "M36.25 36.5q4.75 -7.5 9.5 0");
});

test("asleep flattens the same two arcs rather than drawing new ones", () => {
  // The pose has to survive the 18px the resume-reading chip gives it, where
  // a shut lid can only differ from a smile by being straighter.
  for (const size of [56, 32, 18]) {
    const awake = mascotGeometry(size);
    const asleep = mascotGeometry(size, "asleep");
    assert.ok(asleep.eyeDepth < awake.eyeDepth, `${size}px: lids not flattened`);
    assert.ok(asleep.eyeDepth > 0, `${size}px: lids flattened to nothing`);
    assert.equal(asleep.eyeStroke, awake.eyeStroke, `${size}px: weight changed`);
    assert.equal(asleep.tail, false);
  }
});

test("walking grows the tail and leans the eyes the same way", () => {
  const walk = mascotGeometry(56, "walk");
  assert.equal(walk.tail, true);
  assert.ok(walk.leftX > EYE.leftX, "the eyes must lean into the direction of travel");
  assert.equal(
    walk.rightX - walk.leftX,
    EYE.rightX - EYE.leftX,
    "leaning must move both eyes together, not change their spacing"
  );
});

test("rest is the plain full stop: no tail, eyes where they were drawn", () => {
  const rest = mascotGeometry(56);
  assert.equal(rest.tail, false);
  assert.equal(rest.leftX, EYE.leftX);
  assert.equal(rest.rightX, EYE.rightX);
});

test("the markup carries the parts the size asked for, and no others", () => {
  const big = mascotInner({ size: 56 });
  assert.ok(big.includes("mascot-mouth"), "the mouth is drawn above DETAIL_MIN");
  assert.ok(big.includes("mascot-lip"));
  assert.ok(big.includes("mascot-ring"));

  const small = mascotInner({ size: 16 });
  assert.ok(!small.includes("mascot-mouth"), "no mouth below DETAIL_MIN");
  assert.ok(!small.includes("clipPath"), "no clip with nothing to clip");
  assert.ok(small.includes("var(--mascot-ink)"), "the body is always drawn");
});

test("the mask and the clip are named from the id, so two can share a page", () => {
  const a = mascotInner({ size: 56, id: "one" });
  const b = mascotInner({ size: 56, id: "two" });
  for (const [markup, id] of [[a, "one"], [b, "two"]] as const) {
    assert.ok(markup.includes(`id="${id}-eyes"`), `${id}: mask not named`);
    assert.ok(markup.includes(`url(#${id}-eyes)`), `${id}: mask not referenced`);
    assert.ok(markup.includes(`id="${id}-body"`), `${id}: clip not named`);
  }
  assert.ok(!a.includes("two-"), "ids must not leak between drawings");
});

test("the tail is markup, not a class — walking is a different silhouette", () => {
  assert.ok(mascotSvg({ size: 56, pose: "walk" }).includes("M18 46C"));
  assert.ok(!mascotSvg({ size: 56 }).includes("M18 46C"));
});

test("the element carries its own size and hides itself from assistive tech", () => {
  const svg = mascotSvg({ size: 30, id: "x" });
  assert.ok(svg.startsWith('<svg width="30" height="30"'));
  assert.ok(svg.includes('aria-hidden="true"'));
  assert.ok(svg.endsWith("</svg>"));
});

test("the heading's final stop is what gets swapped", () => {
  const out = replaceFinalStop('<h1 id="hey">Hey, I\'m Kyrylo Leshchenko.</h1>', "<X/>");
  assert.equal(out, '<h1 id="hey">Hey, I\'m Kyrylo Leshchenko<X/></h1>');
});

test("only the FIRST h1, and only its own trailing stop", () => {
  // A period inside the sentence must not be touched, and a second heading
  // further down the note is not the greeting.
  const out = replaceFinalStop("<h1>One. Two.</h1><p>x.</p><h1>Three.</h1>", "<X/>");
  assert.equal(out, "<h1>One. Two<X/></h1><p>x.</p><h1>Three.</h1>");
});

test("a heading it has no business rewriting is left exactly alone", () => {
  // No h1; no trailing stop; and markup of its own — a link or a bold word
  // means the vault wrote something this can't reason about.
  for (const html of [
    "<p>Hey.</p>",
    "<h1>Hey, I'm Kyrylo Leshchenko</h1>",
    "<h1>Hey, I'm <strong>Kyrylo</strong>.</h1>",
    "<h1></h1>",
  ]) {
    assert.equal(replaceFinalStop(html, "<X/>"), html, html);
  }
});

test("the lip and the ring fatten as the drawing shrinks, like the eyes", () => {
  const sizes = [64, 40, 32, 24, 16, 12];
  for (let i = 1; i < sizes.length; i++) {
    const bigger = mascotGeometry(sizes[i - 1]);
    const smaller = mascotGeometry(sizes[i]);
    assert.ok(smaller.lipStroke >= bigger.lipStroke, `lip thins at ${sizes[i]}px`);
    assert.ok(smaller.ringStroke >= bigger.ringStroke, `ring thins at ${sizes[i]}px`);
  }
});

test("detail can be forced against the size rule, both ways", () => {
  // The greeting's stop is 16px and asks for the full face anyway; nothing
  // asks for the reverse yet, but the override has to work in both directions
  // or it is a special case rather than a parameter.
  assert.equal(mascotGeometry(16).detail, false);
  assert.equal(mascotGeometry(16, "rest", true).detail, true);
  assert.equal(mascotGeometry(56).detail, true);
  assert.equal(mascotGeometry(56, "rest", false).detail, false);
});

test("a forced face reaches the markup, strokes and all", () => {
  const forced = mascotInner({ size: 16, detail: true });
  assert.ok(forced.includes("mascot-mouth"), "no mouth in a forced face");
  assert.ok(forced.includes("mascot-lip"));
  assert.ok(forced.includes("mascot-ring"));
  // Fattened, or the lip is a sub-pixel line at this size.
  assert.ok(
    forced.includes(`stroke-width="${mascotGeometry(16).lipStroke}"`),
    "the lip did not take the small-size stroke"
  );
});
