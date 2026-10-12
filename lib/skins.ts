/**
 * Note skins: one note, its own look (DECISIONS #234).
 *
 * `skin: monster` in a note's frontmatter hands that one page to a stylesheet
 * and a small driver of its own, and the design rules in
 * docs/DESIGN-SYSTEM.md stop at its edge. Nothing a skin ships reaches another
 * page: the stylesheet is a file in `public/skins/` linked by the skinned page
 * alone, every selector in it is scoped to `[data-skin]`
 * (scripts/skins.test.mjs), and the driver is a lazy chunk.
 *
 * Pure and client-safe: no `fs`.
 */

/** Every skin there is. A name here needs `public/skins/<name>.css`. */
export const SKINS = ["monster"] as const;
export type Skin = (typeof SKINS)[number];

/** The note's skin, or undefined for a note without one or a name not in the list. */
export function entrySkin(meta: Record<string, unknown>): Skin | undefined {
  const raw = typeof meta.skin === "string" ? meta.skin.trim().toLowerCase() : "";
  return (SKINS as readonly string[]).includes(raw) ? (raw as Skin) : undefined;
}

/** Longest opening the skin will cut together: a title sequence, not a film. */
export const MAX_BEATS = 4;

/**
 * `skin_beats: [Unleash, the, Beast]`: the words the page opens on, one full
 * plate each, before the title. A list or a comma-separated string, like
 * `categories:`. Empty when the key is missing, and then nothing plays.
 */
export function skinBeats(meta: Record<string, unknown>): string[] {
  const raw = meta.skin_beats;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  return list
    .map((word) => String(word).trim())
    .filter(Boolean)
    .slice(0, MAX_BEATS);
}
