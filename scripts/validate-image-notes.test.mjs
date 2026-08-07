import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { validateImageNotes, MAX_INLINE_SVG } from "./validate-image-notes.mjs";
import { MAX_INLINE_SVG as PIPELINE_MAX_INLINE_SVG } from "@/lib/markdown";

const DARK_STYLE = `
  <style>
    .label { fill: #33373d; }
    @media (prefers-color-scheme: dark) { .label { fill: #e6e8eb; } }
  </style>`;

function svg({
  viewBox = "0 0 300 400",
  accessible = true,
  ariaLabel = "A source-faithful diagram",
  unsafe = "",
} = {}) {
  const access = accessible ? ` role="img" aria-label="${ariaLabel}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${access}>
    ${DARK_STYLE}
    ${unsafe}
    <text class="label" x="20" y="40">Note</text>
  </svg>`;
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultsite-image-note-"));
  const posts = path.join(dir, "Posts");
  const assets = path.join(posts, "attachments");
  fs.mkdirSync(assets, { recursive: true });
  return {
    dir,
    posts,
    assets,
    write(name, content) {
      const file = path.join(assets, name);
      fs.writeFileSync(file, content);
      return file;
    },
    note(body) {
      fs.writeFileSync(path.join(posts, "Note.md"), body);
    },
  };
}

async function photo(file, { exif = false, width = 300, height = 400 } = {}) {
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 235, g: 232, b: 220 } },
  });
  if (exif) image = image.withExif({ IFD0: { Make: "Test Camera" } });
  await image.jpeg().toFile(file);
}

async function validFixture() {
  const f = fixture();
  f.note(`![[timeline.svg|Life timeline :: Життєвий шлях]]
<!-- image-note: timeline-original.jpeg -->`);
  f.write("timeline.svg", svg());
  f.write("timeline.uk.svg", svg({ ariaLabel: "Точна до джерела схема" }));
  await photo(path.join(f.assets, "timeline-original.jpeg"));
  return f;
}

test("accepts a complete, sanitized bilingual SVG image note", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  const result = await validateImageNotes({ vaultDir: f.dir });
  assert.equal(result.count, 1);
  assert.deepEqual(result.errors, []);
});

test("the inline limit matches the one the Markdown pipeline enforces", () => {
  // Two copies of the number exist so the validator doesn't have to import the
  // whole pipeline. This is what stops them drifting apart.
  assert.equal(MAX_INLINE_SVG, PIPELINE_MAX_INLINE_SVG);
});

test("rejects a self-theming SVG too large to be inlined", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  // Padded past the ceiling with a comment, so it stays a valid, safe SVG and
  // the only thing wrong with it is its size.
  const padding = `<!-- ${"x".repeat(MAX_INLINE_SVG)} -->`;
  f.write("timeline.svg", svg().replace("</svg>", `${padding}</svg>`));

  const result = await validateImageNotes({ vaultDir: f.dir });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /exceeds the 64KB inline limit/);
  assert.match(result.errors[0], /freeze in one theme/);
});

test("reports missing translations and original assets", async (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.note(`![[timeline.svg|Life timeline :: Життєвий шлях]]
<!-- image-note: absent.jpeg -->`);
  f.write("timeline.svg", svg());
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  assert.ok(errors.some((error) => error.includes("original photo not found")));
  assert.ok(errors.some((error) => error.includes("Ukrainian diagram not found")));
});

test("rejects mismatched language and photo geometry", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.write("timeline.uk.svg", svg({ viewBox: "0 0 300 410" }));
  await photo(path.join(f.assets, "timeline-original.jpeg"), { width: 400, height: 300 });
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  assert.ok(errors.some((error) => error.includes("viewBox must match")));
  assert.ok(errors.some((error) => error.includes("aspect ratio differs")));
});

test("rejects original photos that retain EXIF", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  await photo(path.join(f.assets, "timeline-original.jpeg"), { exif: true });
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  assert.ok(errors.some((error) => error.includes("still contains orientation or descriptive metadata")));
});

test("rejects inaccessible self-theming SVGs", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.write("timeline.svg", svg({ accessible: false }));
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  assert.ok(errors.some((error) => error.includes('requires role="img"')));
});

test("rejects active, embedded, and externally loaded SVG content", async (t) => {
  const f = await validFixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.write(
    "timeline.svg",
    svg({
      unsafe: `<script>bad()</script><foreignObject><p>HTML</p></foreignObject><image href="https://example.com/note.png" />`,
    })
  );
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  const unsafe = errors.find((error) => error.includes("unsafe SVG content"));
  assert.match(unsafe ?? "", /script elements/);
  assert.match(unsafe ?? "", /foreignObject elements/);
  assert.match(unsafe ?? "", /external or executable resources/);
});

test("requires complete bilingual light and dark Excalidraw exports", async (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.dir, { recursive: true, force: true }));
  f.note(`![[Journey.excalidraw|Life timeline :: Життєвий шлях]]
<!-- image-note: journey-original.jpeg -->`);
  const exported = svg({ accessible: false });
  f.write("Journey.excalidraw.light.svg", exported);
  f.write("Journey.excalidraw.dark.svg", exported);
  f.write("Journey.uk.excalidraw.light.svg", exported);
  await photo(path.join(f.assets, "journey-original.jpeg"));
  const { errors } = await validateImageNotes({ vaultDir: f.dir });
  assert.ok(
    errors.some((error) => error.includes("Excalidraw UK image note requires both light and dark SVG exports"))
  );
});
