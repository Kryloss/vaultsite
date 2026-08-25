/**
 * Bring a photograph of a book's spine into the vault.
 *
 *   node scripts/import-spine.mjs <source> <slug>[.uk]
 *   node scripts/import-spine.mjs ~/Downloads/IMG000.jpg sapiens
 *   node scripts/import-spine.mjs ~/Downloads/IMG001.jpg sapiens.uk
 *
 * Writes vault/Shelf/Books/spines/<slug>-spine.jpg (or …-spine.uk.jpg), then
 * prints how far every edge of the RESULT sits from its own neighbourhood so
 * the crop is verified rather than assumed.
 *
 * This exists because the procedure is not obvious and I got it wrong three
 * times doing it by hand — see docs/DECISIONS.md #110. Two passes, and they
 * solve genuinely different problems:
 *
 * 1. **The paper.** The studio background, found by difference from the
 *    corner colour. NOT by a frame-wide bounding box (one dark pixel anywhere
 *    in a column defeats it, so an edge strip survives) and NOT by a fixed
 *    brightness threshold (The Little Prince's outermost column already reads
 *    227 because the book's edge lands inside it, while cream Sapiens' own
 *    face runs 145–225 and any threshold strict enough to catch paper eats
 *    the book). Per-column/row MEDIAN against the corner background works on
 *    all of them.
 *
 * 2. **The book's own head and tail.** Removing the paper is not enough: the
 *    top and bottom of a spine catch the light, and on The Hero with a
 *    Thousand Faces that band ran three rows deep at +55 over its own face —
 *    which against a near-black page is a white line whatever it is. Found as
 *    a STEP against rows further in, never against a global interior median:
 *    The Old Man and the Sea is a vertical gradient from pale blue to brown,
 *    and an interior test would strip its artwork off both ends.
 *
 * The step walk can stop early on a plateau — the Ukrainian Old Man had a
 * +33 step, and shaving it revealed a +59 step underneath — so pass 2 repeats
 * until the edges settle, bounded so it can never run away.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Width every spine is stored at. Painted at 25–45px, so this is ample. */
const OUT_W = 160;
/**
 * A strip is PAPER while it is closer to the background than to the book's
 * own face. No fixed tolerance, because none exists that serves both ends of
 * the range: "clearly darker than the page" walks straight through white
 * Footprints on the Road (face 232 against paper 255), while a tight number
 * stops early on black Campbell, where 255 → black passes through 250, 246,
 * 235 and leaves a white column standing. Asking which of the two a strip
 * resembles needs no constant at all and is right for both.
 */
const isPaperish = (v, bg, face) => Math.abs(v - bg) < Math.abs(v - face);

/**
 * Where paper WAS found, keep going while the ramp is still falling.
 *
 * The paper→book transition in these photographs is soft — four to six pixels
 * — so the midpoint above lands part way down it and leaves a light edge (The
 * Little Prince kept a +146 column). Following the gradient until it flattens
 * ends the crop where the artwork begins. Gated on paper having been found,
 * so a book photographed flush to the frame keeps its own lit edge:
 * Footprints has no margin at all and must not be cut.
 */
const RAMP_FRACTION = 0.08;
const RAMP_FLOOR = 3;

/** Report floor: an edge this close to the background is paper, whatever else. */
const SUSPECT = 10;
/** A jump this big between an edge row and the row 4 in is a band, not art. */
const STEP = 18;
/** An edge within this of its neighbourhood is the book. */
const SETTLED = 12;
/** Pass 2 never eats more than this fraction of the height, per end, per pass. */
const CAP = 0.015;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return Math.round(s[s.length >> 1]);
};

/** Grey medians down each column and across each row of a raw RGB buffer. */
function sampler({ data, info }) {
  const { width: w, height: h, channels: c } = info;
  const g = (x, y) => {
    const i = (y * w + x) * c;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const col = (x) =>
    median([...Array(60)].map((_, k) => g(x, Math.round(h * 0.2) + Math.round((k * h * 0.6) / 60))));
  const row = (y) =>
    median([...Array(40)].map((_, k) => g(Math.round(w * 0.2) + Math.round((k * w * 0.6) / 40), y)));
  return { w, h, g, col, row };
}

/**
 * Each edge of an image: how far it sits from the same measure four pixels in
 * (`delta`), and how bright it is in absolute terms (`abs`).
 *
 * BOTH are needed to judge it. A delta alone cannot tell leftover paper from
 * the book itself: The Order of Time is purple leather with a lit sheen along
 * both edges, +30 over its neighbours and entirely real. What makes an edge
 * suspect is being brighter than its surroundings AND still close to the
 * paper it was cut out of.
 */
export async function edgeDeltas(input) {
  const s = sampler(await sharp(input).raw().toBuffer({ resolveWithObject: true }));
  const at = (delta, abs) => ({ delta, abs });
  return {
    w: s.w,
    h: s.h,
    left: at(s.col(0) - s.col(4), s.col(0)),
    right: at(s.col(s.w - 1) - s.col(s.w - 5), s.col(s.w - 1)),
    top: at(s.row(0) - s.row(4), s.row(0)),
    bottom: at(s.row(s.h - 1) - s.row(s.h - 5), s.row(s.h - 1)),
  };
}

/**
 * Is this edge leftover paper, or just a lit edge of the book?
 *
 * Judged with the same per-image tolerance the crop used, widened a little —
 * a fixed number here was what let a +216 white column pass as "fine".
 */
export function looksLikePaper(edge, bg, tol = RAMP_FLOOR) {
  return Math.abs(edge.abs - bg) <= Math.max(SUSPECT, tol * 2);
}

/**
 * Pass 1 — strip the studio paper from all four sides.
 *
 * Everything is measured from THIS image: the background from the corners,
 * the book's own face from the middle. See isPaperish and RAMP_FRACTION.
 */
export async function paperBox(input) {
  const s = sampler(await sharp(input).raw().toBuffer({ resolveWithObject: true }));
  const bg = median([s.g(0, 0), s.g(s.w - 1, 0), s.g(0, s.h - 1), s.g(s.w - 1, s.h - 1)]);
  /* The book's face, from the middle fifth. This ASSUMES the spine is roughly
     centred in the frame, which every product shot these come from is. An
     off-centre spine makes `face` read as paper, nothing looks paperish, and
     the image passes through uncropped — which is the right way to fail: the
     report shows dimensions that did not change, rather than a plausible crop
     through the middle of a book. Covered by a test. */
  const face = median(
    [...Array(20)].map((_, k) => s.col(Math.round(s.w * 0.4) + Math.round((k * s.w * 0.2) / 20)))
  );
  const ramp = Math.max(RAMP_FLOOR, Math.abs(bg - face) * RAMP_FRACTION);

  /** Strips from one end inward: the paper, then down the blend ramp. */
  const eat = (at, limit) => {
    let i = 0;
    while (i < limit - 1 && isPaperish(at(i), bg, face)) i++;
    if (i === 0) return 0; // flush to the frame — nothing to trim
    while (i < limit - 1 && Math.abs(at(i) - at(i + 1)) > ramp) i++;
    return i;
  };

  /* COLUMNS FIRST, then rows on the result. Both against the original frame
     is wrong when the book is narrow in a wide photograph: a row median
     sampled across the frame's middle is then mostly paper, every row reads
     as paper, and the vertical walk eats the book. New Version is 157px of
     spine in a 941px frame and collapsed to 2px tall. */
  const hcap = Math.floor(s.w * 0.45);
  const l = eat((i) => s.col(i), hcap);
  const rCut = eat((i) => s.col(s.w - 1 - i), hcap);
  const sides = { left: l, top: 0, width: s.w - l - rCut, height: s.h };
  if (sides.width < 8) throw new Error(`crop collapsed horizontally to ${sides.width}px`);
  const buf = await sharp(input).extract(sides).png().toBuffer();

  const s2 = sampler(await sharp(buf).raw().toBuffer({ resolveWithObject: true }));
  const vcap = Math.floor(s2.h * 0.45);
  const top = eat((i) => s2.row(i), vcap);
  const bCut = eat((i) => s2.row(s2.h - 1 - i), vcap);
  const box = { left: 0, top, width: s2.w, height: s2.h - top - bCut };
  if (box.height < 8) throw new Error(`crop collapsed vertically to ${box.height}px`);

  return {
    buf: await sharp(buf).extract(box).png().toBuffer(),
    bg,
    face,
    tol: ramp,
    box: { left: sides.left, top: box.top, width: box.width, height: box.height },
  };
}

/** removePaper, kept as the single-image entry point. */
const removePaper = paperBox;


/**
 * Pass 2 — shave the lit head and tail.
 *
 * Found as the sharpest DISCONTINUITY within the first few percent of each
 * end, and cut just past it. Walking inward "while the step is large" was the
 * obvious version and it is wrong: a band thicker than the comparison window
 * is flat in its own middle, so the walk never enters it and reports the
 * spine clean (it did — see the test). A gradient has no discontinuity
 * anywhere, so it survives untouched, which is the property an interior-
 * median test cannot give.
 *
 * Repeats, because a band can be layered: the Ukrainian Old Man had a +33
 * step, and shaving it revealed a +59 step underneath.
 */
async function shaveEnds(buf) {
  let out = buf;
  let cutTop = 0;
  let cutBottom = 0;
  for (let pass = 0; pass < 6; pass++) {
    const s = sampler(await sharp(out).raw().toBuffer({ resolveWithObject: true }));
    const cap = Math.max(4, Math.round(s.h * CAP));
    const cutAt = (rowAt) => {
      let best = 0;
      let bestAt = -1;
      for (let i = 0; i < cap; i++) {
        const d = Math.abs(rowAt(i + 1) - rowAt(i));
        if (d > best) {
          best = d;
          bestAt = i;
        }
      }
      return best > STEP ? bestAt + 1 : 0;
    };
    const t = cutAt((i) => s.row(i));
    const b = cutAt((i) => s.row(s.h - 1 - i));
    if (t === 0 && b === 0) break;
    cutTop += t;
    cutBottom += b;
    out = await sharp(out)
      .extract({ left: 0, top: t, width: s.w, height: s.h - t - b })
      .png()
      .toBuffer();
  }
  return { buf: out, cutTop, cutBottom };
}

/**
 * Import a book's two scans — English and Ukrainian — at IDENTICAL dimensions.
 *
 * Worth a mode of its own because the alternative is worse in both directions.
 * Two photographs of one book agree to only a few percent, and letting each
 * keep its own crop means either the spine changes width when the reader
 * toggles language, or one image is squeezed into the other's box and
 * `object-fit: cover` eats the difference — which is how The Last Wish lost
 * the wolf at its foot.
 *
 * So the two crops are computed independently and then INTERSECTED: the
 * tightest box that contains no paper in either. The head/tail shave takes
 * the deeper of the two for the same reason. Both are then encoded at one
 * size, so `spineAr === spineUkAr` and nothing moves across the toggle.
 */
export async function importPair(srcEn, srcUk, destEn, destUk) {
  const [a, b] = await Promise.all([paperBox(srcEn), paperBox(srcUk)]);
  const box = {
    left: Math.max(a.box.left, b.box.left),
    top: Math.max(a.box.top, b.box.top),
  };
  box.width = Math.min(a.box.left + a.box.width, b.box.left + b.box.width) - box.left;
  box.height = Math.min(a.box.top + a.box.height, b.box.top + b.box.height) - box.top;
  if (box.width < 8 || box.height < 8)
    throw new Error(`the two scans barely overlap (${box.width}x${box.height}) — crop them apart`);

  const cropped = await Promise.all(
    [srcEn, srcUk].map((f) => sharp(f).extract(box).png().toBuffer())
  );
  const ends = await Promise.all(cropped.map(shaveEnds));
  const cutTop = Math.max(ends[0].cutTop, ends[1].cutTop);
  const cutBottom = Math.max(ends[0].cutBottom, ends[1].cutBottom);

  const out = [];
  for (const [i, dest] of [destEn, destUk].entries()) {
    const m = await sharp(cropped[i]).metadata();
    await sharp(cropped[i])
      .extract({ left: 0, top: cutTop, width: m.width, height: m.height - cutTop - cutBottom })
      .resize({ width: OUT_W })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(dest);
    out.push({ dest, edges: await edgeDeltas(dest) });
  }
  return { box, cutTop, cutBottom, bg: a.bg, tol: Math.max(a.tol, b.tol), results: out };
}

/** Both passes, then encode at the vault's width. Metadata is dropped. */
export async function importSpine(src, dest) {
  const paper = await removePaper(src);
  const ends = await shaveEnds(paper.buf);
  await sharp(ends.buf).resize({ width: OUT_W }).jpeg({ quality: 84, mozjpeg: true }).toFile(dest);
  return { ...ends, paperBox: paper.box, bg: paper.bg, face: paper.face, tol: paper.tol, edges: await edgeDeltas(dest) };
}

const DIR = path.join(process.cwd(), "vault", "Shelf", "Books", "spines");

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, slug, ukSrc] = process.argv.slice(2);
  if (!src || !slug) {
    console.error(
      "usage: node scripts/import-spine.mjs <source> <slug>[.uk] [ukSource]\n" +
        "       a third argument imports both scans at identical dimensions"
    );
    process.exit(1);
  }
  const uk = slug.endsWith(".uk");
  const base = uk ? slug.slice(0, -3) : slug;
  const dest = path.join(DIR, `${base}-spine${uk ? ".uk" : ""}.jpg`);
  fs.mkdirSync(DIR, { recursive: true });

  if (ukSrc) {
    const r = await importPair(src, ukSrc, path.join(DIR, `${base}-spine.jpg`), path.join(DIR, `${base}-spine.uk.jpg`));
    const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
    let bad = false;
    console.log(`${base}-spine.jpg + .uk.jpg  (shared crop)`);
    console.log(`  box     ${r.box.width}x${r.box.height} at ${r.box.left},${r.box.top}` +
      `   ends ${r.cutTop} head / ${r.cutBottom} tail`);
    for (const { dest: d, edges: e } of r.results) {
      const flags = ["left", "right", "top", "bottom"].filter((k) => looksLikePaper(e[k], r.bg, r.tol));
      bad ||= flags.length > 0;
      console.log(
        `  ${path.basename(d).padEnd(28)} ${e.w}x${e.h}  1:${(e.h / e.w).toFixed(2)}  ` +
          `L ${sign(e.left.delta)}/${e.left.abs} R ${sign(e.right.delta)}/${e.right.abs} ` +
          `T ${sign(e.top.delta)}/${e.top.abs} B ${sign(e.bottom.delta)}/${e.bottom.abs}` +
          (flags.length ? `  ⚠ ${flags.join(",")}` : "")
      );
    }
    const [x, y] = r.results.map((v) => `${v.edges.w}x${v.edges.h}`);
    console.log(x === y ? `  ✓ identical dimensions (${x})` : `  ✗ DIMENSIONS DIFFER: ${x} vs ${y}`);
    if (bad || x !== y) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const r = await importSpine(src, dest);
  const sides = ["left", "right", "top", "bottom"];
  const suspect = sides.filter((k) => looksLikePaper(r.edges[k], r.bg, r.tol));
  const show = (k) => {
    const e = r.edges[k];
    const d = e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
    return `${k[0].toUpperCase()} ${d}/${e.abs}${looksLikePaper(e, r.bg, r.tol) ? "!" : ""}`;
  };
  console.log(
    `${path.basename(dest)}\n` +
      `  paper   ${r.paperBox.width}x${r.paperBox.height} (bg ${r.bg}, face ${r.face}, ramp ${r.tol.toFixed(0)})\n` +
      `  ends    shaved ${r.cutTop} head / ${r.cutBottom} tail\n` +
      `  result  ${r.edges.w}x${r.edges.h}  1:${(r.edges.h / r.edges.w).toFixed(2)}\n` +
      `  edges   ${sides.map(show).join("  ")}   (delta/absolute)\n` +
      (suspect.length
        ? `  ⚠ ${suspect.join(", ")} still look like paper — open the file and check`
        : `  ✓ no edge resembles the background; lit edges of the book are fine`)
  );
  if (suspect.length) process.exitCode = 1;
}
