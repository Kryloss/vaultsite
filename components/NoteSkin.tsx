"use client";

import dynamic from "next/dynamic";
import type { Skin } from "@/lib/skins";
import type { SkinArt } from "@/components/skins/MonsterSkin";

/**
 * A note's skin: the one place a page stops looking like the site
 * (lib/skins.ts, DECISIONS #234).
 *
 * Rendered by the entry page for a note with `skin:` in its frontmatter and
 * for no other, so the two things a skin costs are paid by that page alone:
 *
 * - The stylesheet is a plain file in `public/skins/`, linked here. A CSS
 *   import would join the entry route's bundle and every note would download
 *   it. `precedence` has React hoist the link into <head> and hold the page
 *   back until it has loaded, on a hard load and on a client navigation alike,
 *   so the note is never seen in the site's own clothes first.
 * - The driver is a chunk of its own. That is why this file is a client
 *   component: `next/dynamic` only splits what a CLIENT component imports.
 *   Called from the server page it bundled the driver into the entry route's
 *   own chunk, and every note shipped the smoke shader.
 */
const MonsterSkin = dynamic(() => import("@/components/skins/MonsterSkin"));

export default function NoteSkin({
  skin,
  beats,
  art,
}: {
  skin: Skin;
  /** Words of the opening cuts: `skin_beats:`. */
  beats: string[];
  /** The picture behind the title: `skin_art:`, resolved by the page. */
  art?: SkinArt;
}) {
  return (
    <>
      <link rel="stylesheet" href={`/skins/${skin}.css`} precedence="skin" />
      {skin === "monster" && <MonsterSkin beats={beats} art={art} />}
    </>
  );
}
