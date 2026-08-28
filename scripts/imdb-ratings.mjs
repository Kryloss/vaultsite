#!/usr/bin/env node
/**
 * Refresh the `imdb:` rating on every shelf note that carries an `imdb_id:`.
 *
 *   node scripts/imdb-ratings.mjs           # rewrite the notes
 *   node scripts/imdb-ratings.mjs --check   # report drift, change nothing
 *
 * Two frontmatter keys, doing different jobs:
 *
 * - `imdb_id:` is the IDENTITY (`tt0903747`) and is written ONCE, by hand or
 *   by whoever adds the note. This script never guesses one. Resolving a title
 *   to an IMDb id automatically is exactly where it would go wrong quietly —
 *   "Seven", "Dark" and "Prisoners" each name several films — and a wrong id
 *   here prints a confident, wrong number on a page. Get it from the film's
 *   Wikidata item (property P345) or from the IMDb URL itself.
 * - `imdb:` is the VALUE, and it is this script's to own. It goes stale on its
 *   own as votes come in, so it is written into the vault rather than fetched
 *   at build: the site is fully static and a build that reaches the network is
 *   a build that can fail for reasons that have nothing to do with the code.
 *
 * The source is IMDb's own published dataset — `title.ratings.tsv.gz` from
 * datasets.imdbws.com, no key, refreshed daily by IMDb, and licensed for
 * personal and non-commercial use, which is what this site is. It is ~8MB
 * compressed and ~1.7M rows; we stream it and keep only the ids we asked for,
 * so nothing large is ever held in memory or written to the repo.
 *
 * A rating is IMDb's number and is presented as theirs. Kyrylo's own verdict
 * is the separate `rating:` key, drawn as stars — see DECISIONS #114.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHELF = path.join(ROOT, "vault", "Shelf");
const DATASET = "https://datasets.imdbws.com/title.ratings.tsv.gz";

/** Every `.md` under the shelf that is a note rather than a translation. */
function notes(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...notes(p));
    else if (e.name.endsWith(".md") && !e.name.endsWith(".uk.md")) out.push(p);
  }
  return out;
}

/** `imdb_id: tt0903747` → "tt0903747". Frontmatter only, so a note that merely
    mentions an id in its prose is not mistaken for one that declares it. */
function readId(source) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!fm) return undefined;
  const m = /^imdb_id:\s*(tt\d+)\s*$/m.exec(fm[1]);
  return m ? m[1] : undefined;
}

function readRating(source) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!fm) return undefined;
  const m = /^imdb:\s*([\d.]+)\s*$/m.exec(fm[1]);
  return m ? m[1] : undefined;
}

async function fetchRatings(wanted) {
  const res = await fetch(DATASET, {
    headers: { "User-Agent": "vaultsite/1.0 (personal site; imdb-ratings.mjs)" },
  });
  if (!res.ok) throw new Error(`${DATASET} → HTTP ${res.status}`);

  const found = new Map();
  const gunzip = zlib.createGunzip();
  const body = res.body;
  // Node's fetch gives a web stream; Readable.fromWeb is the bridge.
  const { Readable } = await import("node:stream");
  Readable.fromWeb(body).pipe(gunzip);

  const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });
  for await (const line of rl) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const id = line.slice(0, tab);
    if (!wanted.has(id)) continue;
    const [, rating, votes] = line.split("\t");
    found.set(id, { rating, votes: Number(votes) });
    // Stop the moment every id is accounted for — the ids we want are mostly
    // popular titles and cluster early, so this usually skips most of the file.
    if (found.size === wanted.size) {
      rl.close();
      break;
    }
  }
  return found;
}

const check = process.argv.includes("--check");

const files = notes(SHELF)
  .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }))
  .map((n) => ({ ...n, id: readId(n.source), was: readRating(n.source) }))
  .filter((n) => n.id);

if (files.length === 0) {
  console.log("[imdb-ratings] no notes carry an imdb_id: — nothing to do");
  process.exit(0);
}

const wanted = new Set(files.map((n) => n.id));
console.log(`[imdb-ratings] ${files.length} note(s), ${wanted.size} id(s)`);

const found = await fetchRatings(wanted);

let changed = 0;
let missing = 0;
for (const n of files) {
  const hit = found.get(n.id);
  const name = path.relative(ROOT, n.file);
  if (!hit) {
    // An id IMDb has no rating for is a real state (an unreleased title), not
    // an error — but a TYPO in an id looks exactly the same, so say so.
    console.warn(`  ! ${name}: ${n.id} not in the dataset — check the id`);
    missing++;
    continue;
  }
  if (n.was === hit.rating) continue;
  changed++;
  console.log(
    `  ${check ? "~" : "→"} ${name}: ${n.was ?? "—"} → ${hit.rating} ` +
      `(${hit.votes.toLocaleString("en-US")} votes)`
  );
  if (check) continue;

  const votes = hit.votes.toLocaleString("en-US");
  let out = n.source.replace(/^imdb:\s*[\d.]+\s*$/m, `imdb: ${hit.rating}`);
  out = out.replace(
    /^#\s+\(datasets\.imdbws\.com\), [\d,]+ votes at import\.$/m,
    `#       (datasets.imdbws.com), ${votes} votes at import.`
  );
  fs.writeFileSync(n.file, out);
}

console.log(
  `[imdb-ratings] ${changed} ${check ? "would change" : "updated"}, ` +
    `${files.length - changed - missing} already current` +
    (missing ? `, ${missing} unresolved` : "")
);
// A drifted rating is not a build failure; an id that resolves to nothing is
// worth a non-zero exit so a --check in CI can be believed.
process.exit(missing ? 1 : 0);
