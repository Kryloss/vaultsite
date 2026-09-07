/**
 * How much of an entry the "projects" feed shows before "Continue reading".
 *
 * The cut is decided ONCE, on the English body, and both languages take it —
 * because the same note in Ukrainian is roughly a tenth longer in characters
 * for exactly the same words, and a per-language character budget spent that
 * difference by dropping a whole block. "This website" lost its entire list of
 * decisions in Ukrainian (its blocks reach 1063 chars against the English
 * 978) while the English preview kept it, so the two languages were showing
 * visibly different amounts of the same note.
 */

/** Entries longer than this (raw markdown chars) get truncated. */
export const PREVIEW_LIMIT = 1000;

/**
 * A decision about where a body stops: how many whole top-level blocks the
 * preview keeps, and whether the first block alone overflowed and has to be
 * cut mid-paragraph.
 */
export interface PreviewCut {
  blocks: number;
  capFirst: boolean;
}

function blocksOf(md: string): string[] {
  return md.trim().split(/\n\s*\n/);
}

/**
 * Where this body would stop on its own. Returns null when it fits whole.
 */
export function previewCut(md: string, limit: number): PreviewCut | null {
  const trimmed = md.trim();
  if (trimmed.length <= limit) return null;

  const blocks = blocksOf(trimmed);
  if (blocks[0].length > limit) return { blocks: 1, capFirst: true };

  let kept = 0;
  let length = 0;
  for (const block of blocks) {
    if (length + block.length > limit) break;
    kept += 1;
    length += block.length;
  }
  return { blocks: kept, capFirst: false };
}

/**
 * Applies a cut to a body. Returns null when the cut leaves nothing hidden —
 * a translation with fewer blocks than the English original shows in full and
 * gets no "Continue reading" link, which is honest: there is nothing more of
 * it to read.
 */
export function applyPreviewCut(
  md: string,
  cut: PreviewCut,
  limit: number
): string | null {
  const trimmed = md.trim();
  const blocks = blocksOf(trimmed);
  if (cut.capFirst && blocks[0].length > limit) {
    return blocks[0].slice(0, limit).replace(/\s+\S*$/, "") + "…";
  }
  const preview = blocks.slice(0, cut.blocks).join("\n\n");
  return preview.length >= trimmed.length ? null : preview;
}

/**
 * Preview bodies for one entry in both languages, cut at the same block. A
 * body that needs no preview comes back as null and is rendered in full.
 */
export function previewBodies(
  en: string,
  uk: string | null,
  limit: number = PREVIEW_LIMIT
): { en: string | null; uk: string | null } {
  const cut = previewCut(en, limit);
  // The English body fits, so the Ukrainian one shows whole as well: the pair
  // is one note, and "a bit longer in Ukrainian" is not a reason to hide the
  // end of it.
  if (!cut) return { en: null, uk: null };

  const enPreview = applyPreviewCut(en, cut, limit);
  let ukPreview = uk === null ? null : applyPreviewCut(uk, cut, limit);
  // Structures that genuinely differ — a translation that merged paragraphs —
  // fall back to the Ukrainian body deciding for itself, so a long one can't
  // land on the list page whole under a shared cut it outgrew.
  if (uk !== null && ukPreview === null && uk.trim().length > limit) {
    const ownCut = previewCut(uk, limit);
    ukPreview = ownCut ? applyPreviewCut(uk, ownCut, limit) : null;
  }
  return { en: enPreview, uk: ukPreview };
}
