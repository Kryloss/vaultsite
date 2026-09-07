import { VIEWBOX, mascotInner, type MascotPose } from "@/lib/mascot";

/**
 * Krapka — the site's mascot (#158). A server component: one inline SVG, no
 * state, no JS in the browser.
 *
 * It is a full stop with a face. Three tones, all greys, all from tokens:
 * `--mascot-ink` is the body, `--mascot-mid` the open mouth, `--mascot-line`
 * the white lip and ring. The mouth is the ink mixed toward the page, so one
 * drawing serves both themes — the mix lightens near-black ink on the white
 * page and darkens near-white ink on the dark one.
 *
 * The eyes are HOLES (a mask), not strokes painted in the page colour, so the
 * character survives being put on a card, a chip or a cover rather than only
 * on `--bg`.
 *
 * Poses: `rest` is the full stop, `walk` grows the comma's tail and leans the
 * eyes into it, `asleep` flattens the two arcs into shut lids.
 *
 * The drawing itself is `mascotInner()` — a string, because the character also
 * has to be injected into HTML that came out of the Markdown pipeline (the
 * greeting's own full stop, #159), and one builder for both is what stops
 * there being two copies of it. This component is the `<svg>` around it.
 *
 * Decorative: it carries no information the page doesn't already give in
 * words, so it is hidden from assistive tech rather than described.
 *
 * `id` only needs passing if two mascots share a page — the mask and the clip
 * are named from it, and duplicate SVG ids in one document resolve to the
 * first one found.
 */
export default function Mascot({
  size = 56,
  pose = "rest",
  className = "",
  id = "mascot",
  detail,
}: {
  size?: number;
  pose?: MascotPose;
  className?: string;
  id?: string;
  /** Force the mouth, lip and ring on or off, against the size rule. */
  detail?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: mascotInner({ size, pose, id, detail }) }}
    />
  );
}
