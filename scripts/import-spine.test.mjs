import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { importSpine, importPair, edgeDeltas, looksLikePaper } from "./import-spine.mjs";

/**
 * Synthetic spines with a known right answer. The vault's own photographs are
 * the owner's files and can be replaced, so testing against them proves
 * nothing durable — and the two failure modes here are precisely the ones a
 * real photograph made hard to see.
 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-"));
const out = (n) => path.join(tmp, `${n}.jpg`);

/** A spine `body(y)` tall and `sw` wide, centred on white paper. */
async function photo(name, { w = 200, h = 1600, sw = 120, body, band = 0, bandGrey = 240 }) {
  const buf = Buffer.alloc(w * h * 3, 255);
  const x0 = ((w - sw) / 2) | 0;
  for (let y = 40; y < h - 40; y++)
    for (let x = x0; x < x0 + sw; x++) {
      const inBand = y < 40 + band || y >= h - 40 - band;
      const v = inBand ? bandGrey : body(y);
      const i = (y * w + x) * 3;
      buf[i] = v[0] ?? v;
      buf[i + 1] = v[1] ?? v;
      buf[i + 2] = v[2] ?? v;
    }
  const f = path.join(tmp, `${name}-src.png`);
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(f);
  return f;
}

test("the studio paper is removed from all four sides", async () => {
  const src = await photo("flat", { body: () => 40 });
  const r = await importSpine(src, out("flat"));
  // Nothing near-white may survive at any edge — the bug that shipped twice
  // was verifying left and right only.
  for (const side of ["left", "right", "top", "bottom"])
    assert.ok(!looksLikePaper(r.edges[side], r.bg), `${side} = ${JSON.stringify(r.edges[side])}`);
  assert.ok(r.paperBox.width < 130, `cropped to the book, got ${r.paperBox.width}`);
});

test("a lit head and tail do not survive to the edges", async () => {
  // A dark spine whose head and tail catch the light: the Campbell case, where
  // the band read as a white line on a near-black page. 90 against a body of
  // 30 is the realistic relationship — nearer the book than the paper, which
  // is what makes it the SECOND pass's job. (At 200 it is closer to paper than
  // to the book, and pass 1 removes it as paper; that is also correct, which
  // is why this asserts on the OUTCOME rather than on which pass did it.)
  const src = await photo("banded", { body: () => 30, band: 16, bandGrey: 90 });
  const r = await importSpine(src, out("banded"));
  for (const side of ["top", "bottom"]) {
    assert.ok(!looksLikePaper(r.edges[side], r.bg, r.tol), `${side} looks like paper`);
    assert.ok(
      Math.abs(r.edges[side].abs - 30) < 25,
      `${side} is ${r.edges[side].abs}, not the book's face (30)`
    );
  }
});

test("the safety cap stops a runaway crop", async () => {
  // A band deeper than the cap is NOT a lit edge — it is the artwork, or a
  // photograph this routine should not be trusted with. Better to leave it
  // and have the report say the edge is still out of tolerance than to eat
  // 40% of a book quietly.
  const src = await photo("deep", { body: () => 30, band: 400, bandGrey: 200 });
  const r = await importSpine(src, out("deep"));
  assert.ok(r.cutTop + r.cutBottom < 120, `ate too much: ${r.cutTop}/${r.cutBottom}`);
});

test("a book that is a gradient keeps its own artwork", async () => {
  // The Old Man and the Sea: pale at the head, dark at the foot. An interior-
  // median test would call most of this a band and strip both ends.
  const src = await photo("gradient", { body: (y) => 40 + Math.round((y / 1600) * 170) });
  const r = await importSpine(src, out("gradient"));
  assert.equal(r.cutTop, 0, "shaved the head off a gradient");
  assert.equal(r.cutBottom, 0, "shaved the foot off a gradient");
  // and the gradient is still there, top to bottom
  const d = await edgeDeltas(out("gradient"));
  assert.ok(d.h / d.w > 8, "aspect preserved");
});

test("the report tells a lit edge of the book from leftover paper", () => {
  const bg = 255;
  // A DARK book: the ramp is wide, so anything near the page is suspect.
  const darkRamp = 18;
  assert.equal(looksLikePaper({ delta: 30, abs: 130 }, bg, darkRamp), false, "purple sheen");
  assert.equal(looksLikePaper({ delta: 30, abs: 240 }, bg, darkRamp), true, "leftover paper");

  // A WHITE book: its own face is near the page, so the same absolute value
  // must NOT be called paper — Footprints reads 232 against 255 and is the
  // book. This is why the tolerance is per-image and not a constant.
  const paleRamp = 3;
  assert.equal(looksLikePaper({ delta: 4, abs: 232 }, bg, paleRamp), false, "white book");
  assert.equal(looksLikePaper({ delta: 4, abs: 253 }, bg, paleRamp), true, "paper on a white book");
});

test("the result is stored at the vault's width, without metadata", async () => {
  const src = await photo("meta", { body: () => 90 });
  await importSpine(src, out("meta"));
  const m = await sharp(out("meta")).metadata();
  assert.equal(m.width, 160);
  assert.ok(!m.exif, "EXIF survived into the vault");
});

test("a pair is imported at identical dimensions", async () => {
  // Two photographs of one book never agree exactly — different margins, a
  // pixel of height between them. Letting each keep its own crop means the
  // spine changes width when the reader toggles language, or one image is
  // squeezed into the other's box and `object-fit: cover` eats the
  // difference. That is how The Last Wish lost the wolf at its foot.
  const en = await photo("pair-en", { w: 220, h: 1600, sw: 120, body: () => 40 });
  const uk = await photo("pair-uk", { w: 220, h: 1600, sw: 108, body: () => 44 });
  const r = await importPair(en, uk, out("pair-en"), out("pair-uk"));

  const [a, b] = r.results.map((x) => `${x.edges.w}x${x.edges.h}`);
  assert.equal(a, b, "the two scans must render at the same size");

  // and the shared box must leave paper on NEITHER of them
  for (const { edges } of r.results)
    for (const side of ["left", "right", "top", "bottom"])
      assert.ok(!looksLikePaper(edges[side], r.bg, r.tol), `${side} kept paper`);
});

test("an off-centre spine is left alone rather than cropped wrongly", async () => {
  // The book's face is sampled from the middle fifth of the frame, which
  // assumes the spine is roughly centred — true of every product shot these
  // come from. When it is not, `face` reads as paper, nothing looks paperish,
  // and the image passes through UNCROPPED. That is the right way to fail:
  // the report shows dimensions that did not change, rather than a plausible
  // crop through the middle of a book.
  const offCentre = path.join(tmp, "off-src.png");
  await sharp({
    create: { width: 400, height: 1200, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 40, height: 1100, channels: 3, background: { r: 30, g: 30, b: 30 } },
        })
          .png()
          .toBuffer(),
        left: 340,
        top: 50,
      },
    ])
    .png()
    .toFile(offCentre);

  const r = await importSpine(offCentre, out("off"));
  assert.equal(r.paperBox.width, 400, "an undetected spine must not be cropped");
  assert.equal(r.paperBox.height, 1200, "an undetected spine must not be cropped");
});
