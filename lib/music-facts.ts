/**
 * The "At a glance" rows a music note already writes, read back out.
 *
 * Every music note opens with a headerless table — `Released`, `Album` or
 * `Label`, `Length` — and its `.uk.md` sibling writes the same rows in the
 * same order (`Випущено`, `Альбом`, `Тривалість`). The note page renders them
 * as its fact list (`rehypeFactTables`, docs/DECISIONS.md #87). The cover deck
 * on /music prints the same three rows under the centred cover, which is why
 * they are extracted here rather than invented from frontmatter: `date:` is
 * the day the NOTE was written, not the day the record came out, so a caption
 * labelled "Released" cannot be built from it honestly.
 *
 * Nothing new has to be authored for this — the rows exist on all 29 notes.
 *
 * Pure string work with no `fs` behind it, so `npm test` covers it directly;
 * it is called from lib/music.ts at build time and only its OUTPUT reaches the
 * browser. The shapes live in lib/music-filter.ts with the rest of them.
 */
import type { MusicFact } from "@/lib/music-filter";

/**
 * Rows past this are dropped. Every note in the vault writes two or three.
 *
 * THREE is also what the caption reserves height for (`.cf-facts` in
 * globals.css), and the two are one decision: the reservation is what stops
 * the page moving under the reader as they step between a two-row note and a
 * three-row one, and it can only do that if nothing ever renders a fourth.
 * Change both together.
 */
const MAX_FACTS = 3;

/** Runs of consecutive table lines, in source order. */
function tables(md: string): string[][] {
  const out: string[][] = [];
  let run: string[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("|")) {
      run.push(line);
      continue;
    }
    if (run.length) out.push(run);
    run = [];
  }
  if (run.length) out.push(run);
  return out;
}

/**
 * One row's cells. The split ignores an ESCAPED pipe, so a value that contains
 * one survives — no fact value in the vault does today, and silently cutting
 * one in half is the kind of thing nobody would go looking for.
 */
function cells(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
}

/** `|---|---|` — the row that makes the lines above and below a table. */
function isDelimiter(row: string): boolean {
  return /^\|[\s:|-]+\|$/.test(row);
}

/**
 * The label/value pairs of a note's fact table.
 *
 * The table is found by the SAME rule the renderer uses: the first one whose
 * header cells are all empty, which is how Obsidian writes a headerless table
 * and how every fact block on this site opens. A table with a real header is
 * an ordinary table and is left alone.
 */
export function factRows(md: string): { label: string; value: string }[] {
  for (const table of tables(md)) {
    if (table.length < 3 || !isDelimiter(table[1])) continue;
    if (cells(table[0]).some((c) => c !== "")) continue;

    const rows: { label: string; value: string }[] = [];
    for (const line of table.slice(2)) {
      const cs = cells(line);
      const label = cs[0] ?? "";
      /* Everything after the label is the value, rejoined: a three-column
         row would otherwise lose its last cell without saying so. */
      const value = cs.slice(1).join(" ").trim();
      if (label && value) rows.push({ label, value });
    }
    return rows;
  }
  return [];
}

/**
 * The same rows in both languages, merged BY POSITION — the convention the
 * Now page's résumé already uses (lib/now-content.ts), and the only one
 * available here: "Released" and "Випущено" are different strings, so nothing
 * but their order connects them.
 *
 * Position only works while the two tables agree, so a DIFFERENT NUMBER OF
 * ROWS falls back to English for every row rather than merging what it can.
 * A short Ukrainian table would otherwise slide up and print "Тривалість 2024"
 * — a wrong fact, which is worse than an untranslated right one.
 */
export function noteFacts(content: string, contentUk?: string): MusicFact[] {
  const en = factRows(content);
  const uk = contentUk ? factRows(contentUk) : [];
  const paired = uk.length === en.length ? uk : [];

  return en.slice(0, MAX_FACTS).map((row, i) => ({
    label: { en: row.label, uk: paired[i]?.label ?? row.label },
    value: { en: row.value, uk: paired[i]?.value ?? row.value },
  }));
}
