#!/usr/bin/env node
/**
 * Grades a photograph into one of the Monster skin's two looks
 * (docs/DECISIONS.md #234). Run by hand when a skinned note needs a picture:
 *
 *   node scripts/skin-grade.mjs in.jpg vault/Posts/attachments/out.jpg --look bw
 *
 * The output is a JPEG, or a WebP when its name ends in `.webp`.
 *
 * Looks:
 *   bw   high-contrast black and white, highlights blooming into a red halo
 *   red  black to red to white-hot, the same bloom
 *
 * Options: --width 2400, --black 0.06, --white 0.92 (the levels that are
 * crushed to black and blown to white), --bloom 0.9, --grit 0 (0..1, a
 * threshold dither that eats the midtones), --crop x,y,w,h in 0..1 of the
 * source, --gamma 1 (below 1 lifts the midtones), --ambient 0 (0..1, how red
 * the blacks of a `bw` picture go), --red (0..1, how far the picture is taken
 * from black and white toward the red look; `bw` starts at 0 and `red` at 1,
 * and anything between is a picture that is partly both).
 *
 * --key white cuts the subject out of a white studio backdrop and writes it
 * with an alpha channel (the output must be `.webp`). The page can then put
 * type BEHIND the thing photographed. --key-level 0.93 is how bright a pixel
 * has to be to count as backdrop. Name graded files `…-bw` or `…-red`: the
 * skin reads the look off the file name to choose the ink of the type it
 * lays over a picture.
 *
 * Film grain is NOT baked in: the skin lays it over the page live, and noise
 * in a JPEG costs a third of the file for nothing.
 */
import { statSync } from "node:fs";
import sharp from "sharp";

const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
if (!input || !output) {
  console.error("usage: node scripts/skin-grade.mjs <in> <out.jpg|out.webp> --look bw|red");
  process.exit(1);
}

const look = opt("look", "bw");
const width = Number(opt("width", 2400));
const black = Number(opt("black", 0.06));
const white = Number(opt("white", 0.92));
const bloom = Number(opt("bloom", 0.9));
const grit = Number(opt("grit", 0));
const gamma = Number(opt("gamma", 1));
const crop = opt("crop", "");
const ambient = Number(opt("ambient", 0));
const redness = Math.min(1, Math.max(0, Number(opt("red", look === "red" ? 1 : 0))));
const key = opt("key", "");
const keyLevel = Number(opt("key-level", 0.93));

let src = sharp(input).rotate();
if (crop) {
  const meta = await sharp(input).metadata();
  const [x, y, w, h] = crop.split(",").map(Number);
  src = src.extract({
    left: Math.round(x * meta.width),
    top: Math.round(y * meta.height),
    width: Math.round(w * meta.width),
    height: Math.round(h * meta.height),
  });
}
const { data: grey, info } = await src
  .resize({ width, withoutEnlargement: true })
  .greyscale()
  .toColourspace("b-w")
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const n = W * H;

/* The cut-out. Everything bright enough to be backdrop AND reachable from
   the frame's edge is backdrop; a white highlight in the middle of the
   subject is walled in by its darker rim and stays. Then the edge is
   softened and pulled in a pixel, so no rind of studio white comes along. */
let alpha = null;
if (key === "white") {
  const level = keyLevel * 255;
  const backdrop = new Uint8Array(n);
  const stack = [];
  const visit = (i) => {
    if (!backdrop[i] && grey[i] > level) {
      backdrop[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    visit(x);
    visit((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    visit(y * W);
    visit(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    if (x > 0) visit(i - 1);
    if (x < W - 1) visit(i + 1);
    if (i >= W) visit(i - W);
    if (i < n - W) visit(i + W);
  }
  const hard = Buffer.alloc(n);
  for (let i = 0; i < n; i++) hard[i] = backdrop[i] ? 0 : 255;
  const soft = await sharp(hard, { raw: { width: W, height: H, channels: 1 } })
    .blur(1.6)
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  alpha = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (soft[i] - 120) / 100));
    alpha[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
}

/* Levels, then an S-curve: the look is the distance between its darkest and
   lightest marks, so both ends are pushed to the wall. */
const lum = new Float32Array(n);
for (let i = 0; i < n; i++) {
  let v = (grey[i] / 255 - black) / (white - black);
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  v = Math.pow(v, gamma);
  lum[i] = v * v * (3 - 2 * v); // smoothstep
}

/* Halation: the highlights alone, blurred wide, added back. Two radii, a
   tight one that thickens edges and a wide one that fogs the air. */
const hi = Buffer.alloc(n);
for (let i = 0; i < n; i++) {
  const t = (lum[i] - 0.62) / 0.38;
  hi[i] = t <= 0 ? 0 : Math.round(Math.min(1, t) * 255);
}
const blur = async (sigma) =>
  /* `b-w` or sharp hands back three channels and every index below is off. */
  sharp(hi, { raw: { width: W, height: H, channels: 1 } })
    .blur(sigma)
    .toColourspace("b-w")
    .raw()
    .toBuffer();
const [tight, wide] = await Promise.all([blur(W * 0.004), blur(W * 0.022)]);

/* A fixed hash, so a re-run gives the same file. */
const hash = (i) => {
  let x = (i ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
};

const out = Buffer.alloc(n * 3);
const mix = (a, b, t) => a + (b - a) * t;
/* Black, deep red, signal red, and the last tenth goes to white. */
const RED = [
  [0.0, 4, 0, 0],
  [0.3, 120, 6, 0],
  [0.62, 255, 30, 10],
  [0.86, 255, 96, 70],
  [1.0, 255, 246, 240],
];
for (let i = 0; i < n; i++) {
  let v = lum[i];
  if (grit > 0) {
    /* Threshold against noise: midtones break into speckle, the ends hold. */
    const edge = hash(i);
    const hard = v > edge ? 1 : 0;
    v = mix(v, mix(v, hard, 0.85), grit * 4 * v * (1 - v) + grit * 0.25);
  }
  const g = (tight[i] / 255) * 0.45 * bloom + (wide[i] / 255) * 0.75 * bloom;
  /* Both looks are worked out for every pixel and `--red` says how much of
     each: the red one is the ramp, the other is grey with a red halo. */
  let k = 0;
  while (k < RED.length - 2 && v > RED[k + 1][0]) k++;
  const [a0, r0, g0, b0] = RED[k];
  const [a1, r1, g1, b1] = RED[k + 1];
  const t = Math.min(1, Math.max(0, (v - a0) / (a1 - a0)));
  const redR = mix(r0, r1, t) + g * 255;
  const redG = mix(g0, g1, t) + g * 70;
  const redB = mix(b0, b1, t) + g * 46;

  const base = v * 255;
  /* The halo is red, as it is on film: light that went through the emulsion
     and bounced off the base comes back through the red layer first.
     `--ambient` lets the deepest shadows go red instead of grey, the way a
     white object reads in a room lit red. Cubed, so the midtones stay
     neutral and nothing turns pink. */
  const shade = (1 - v) * (1 - v) * (1 - v);
  const greyR = base + g * 255 + ambient * shade * 150;
  const greyG = base + g * 46;
  const greyB = base + g * 30;

  const r = mix(greyR, redR, redness);
  const gr = mix(greyG, redG, redness);
  const b = mix(greyB, redB, redness);
  out[i * 3] = r > 255 ? 255 : r;
  out[i * 3 + 1] = gr > 255 ? 255 : gr;
  out[i * 3 + 2] = b > 255 ? 255 : b;
}

/* `.webp` for a gritty picture: speckle is what JPEG is worst at. */
let graded = sharp(out, { raw: { width: W, height: H, channels: 3 } });
if (alpha) graded = graded.joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } });
await (/\.webp$/i.test(output)
  ? graded.webp({ quality: alpha ? 84 : 76, alphaQuality: 90 })
  : graded.jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:4:4" })
).toFile(output);
const { size } = statSync(output);
console.log(`${output}  ${W}x${H}  ${(size / 1024).toFixed(0)} KB  look=${look}`);
