/**
 * Run with `npm test` — Node's own test runner, no dependencies to install.
 *
 * Covers which images get the reveal (lib/image-reveal.ts). The cases that
 * matter are the ones where it must NOT play, and none of them can be seen on
 * demand in a built page: they depend on what the browser has cached.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REVEAL_FRESH_MS,
  REVEAL_MIN_WIDTH,
  servedFromCache,
  shouldReveal,
} from "./image-reveal.ts";

/** A 40 KB cover fetched over the network, finished 30ms ago. */
const network = { transferSize: 40_300, encodedBodySize: 40_000, duration: 180, responseEnd: 970 };
const arrived = {
  src: "/vault-assets/Shelf/cover-256.webp",
  width: 180,
  optedOut: false,
  timing: network,
  now: 1000,
};

test("a picture that just came over the network is revealed", () => {
  assert.equal(shouldReveal(arrived), true);
});

test("a cache hit is not: nothing was waited for", () => {
  const hit = { ...network, transferSize: 0, duration: 2 };
  assert.equal(servedFromCache(hit), true);
  assert.equal(shouldReveal({ ...arrived, timing: hit }), false);
});

test("a 304 is a cache hit: only headers were transferred", () => {
  // As Chrome reports it (measured on /shelf): 300 of headers, no body, and a
  // round trip as long as a real fetch.
  const revalidated = { ...network, transferSize: 300, encodedBodySize: 0, duration: 196 };
  assert.equal(servedFromCache(revalidated), true);
  assert.equal(shouldReveal({ ...arrived, timing: revalidated }), false);
  // And as the spec describes it, with the cached body's size.
  assert.equal(servedFromCache({ ...network, transferSize: 300 }), true);
});

test("a cross-origin image reports no sizes and is judged by its duration", () => {
  const opaque = { transferSize: 0, encodedBodySize: 0, duration: 240, responseEnd: 970 };
  assert.equal(servedFromCache(opaque), false);
  assert.equal(shouldReveal({ ...arrived, timing: opaque }), true);
  assert.equal(servedFromCache({ ...opaque, duration: 3 }), true);
});

test("a remount long after the fetch is the copy in memory, not an arrival", () => {
  const later = network.responseEnd + REVEAL_FRESH_MS + 1;
  assert.equal(shouldReveal({ ...arrived, now: later }), false);
  assert.equal(shouldReveal({ ...arrived, now: later - 1 }), true);
});

test("with no fetch on record it stays still", () => {
  assert.equal(shouldReveal({ ...arrived, timing: undefined }), false);
});

test("opted-out subtrees, icons and hidden images are left alone", () => {
  assert.equal(shouldReveal({ ...arrived, optedOut: true }), false);
  assert.equal(shouldReveal({ ...arrived, width: REVEAL_MIN_WIDTH - 1 }), false);
  assert.equal(shouldReveal({ ...arrived, width: 0 }), false);
  assert.equal(shouldReveal({ ...arrived, width: REVEAL_MIN_WIDTH }), true);
});

test("SVGs and data URLs are not pictures that arrive", () => {
  assert.equal(shouldReveal({ ...arrived, src: "/vault-assets/diagram.svg" }), false);
  assert.equal(shouldReveal({ ...arrived, src: "/vault-assets/diagram.svg?v=2" }), false);
  assert.equal(shouldReveal({ ...arrived, src: "data:image/webp;base64,AAAA" }), false);
  assert.equal(shouldReveal({ ...arrived, src: "" }), false);
});
