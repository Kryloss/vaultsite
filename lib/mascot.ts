/**
 * Krapka's geometry — the numbers behind `components/Mascot.tsx` (#158).
 *
 * The character is drawn once, on a 64-unit square, and every size is that
 * same drawing scaled. Two things can't just scale with it, which is the whole
 * reason this file exists:
 *
 * - The eyes are STROKES cut out of a FILL, so they thin twice as fast as the
 *   body shrinks. Left alone they close up into an invisible smear well before
 *   the silhouette stops reading. The stroke (and, at the bottom, the arc's
 *   depth) has to grow as the drawing shrinks — the same move `next/font`
 *   already makes for the text with `axes: ["opsz"]`.
 * - The mouth is a 12-unit band with a 2-unit line on it. Under ~28px that is
 *   a sub-pixel smudge that only makes the silhouette look dirty, so below
 *   `DETAIL_MIN` the character is a plain silhouette with eyes — which is the
 *   period it started as.
 *
 * Kept here rather than in the component because it is arithmetic with a right
 * answer and nothing in the vault can exercise it. See lib/mascot.test.ts.
 */

/** The square the character is drawn on. Every path below is in these units. */
export const VIEWBOX = 64;

/** Rendered px below which the mouth, its line and the ring are dropped. */
export const DETAIL_MIN = 28;

/* The body: one circle, sitting in the middle of the box. */
export const BODY = { cx: 32, cy: 32, r: 22 } as const;

/* The eyes: two crescents, low on the face — 4.5 units below the body's
   centre — and 16.5 apart, which is 0.375 of the body's width. Both numbers
   were chosen by eye and then held: wider goes dopey, closer goes tense. */
export const EYE = { y: 36.5, leftX: 18.25, rightX: 36.25, span: 9.5 } as const;

/**
 * The comma tail — the only thing the walking pose adds. The character has two
 * body states and both are real glyphs: a full stop at rest, a comma in
 * motion. It grows from the lower left and descends below the body the way the
 * font's own comma descends below the baseline.
 */
export const TAIL = "M18 46C12 53 8 57 4 62C12 58 21 53 26 47Z";

/** How far the eyes lean into the direction of travel while walking. */
const WALK_LEAN = 1.5;

/**
 * Asleep is the same two arcs flattened, not a different drawing.
 *
 * A curved arch reads as a smile; a flat lid reads as shut. That difference is
 * the whole pose, and it is the only one that still reads at the 18px the
 * resume-reading chip gives it — anything needing a second mark (a z, a
 * different eye shape) is invisible at that size.
 */
const ASLEEP_FLATTEN = 0.34;

export type MascotPose = "rest" | "asleep" | "walk";

/**
 * The open mouth: the part of the body that falls below an arc of radius 26
 * centred at (32, 21). Written out as an explicit path rather than cut with a
 * clip and a mask, so the shape needs no ids and can't collide with a second
 * mascot on the same page. The two ends are where that arc crosses the body
 * (solved once, not at runtime): y = 35.227, x = 32 ± 21.762.
 */
export const MOUTH =
  "M10.238 35.227A26 26 0 0 0 53.762 35.227A22 22 0 0 1 10.238 35.227Z";

/** The lip: the mouth's top edge alone, stroked. Clipped to the body, or its
    stroke would poke out past the silhouette at both corners. */
export const LIP = "M10.238 35.227A26 26 0 0 0 53.762 35.227";

export type MascotGeometry = {
  /** Stroke width for the eye crescents, in viewBox units. */
  eyeStroke: number;
  /** How far each crescent's control point lifts above its ends. */
  eyeDepth: number;
  /** Whether the mouth, the lip line and the ring are drawn at all. */
  detail: boolean;
  /** Stroke widths for the lip and the ring — ramped like the eyes. */
  lipStroke: number;
  ringStroke: number;
  /** Left end of each crescent — the walking pose leans them forward. */
  leftX: number;
  rightX: number;
  /** Whether the comma tail is drawn. */
  tail: boolean;
};

/**
 * Geometry for a mascot rendered at `size` CSS pixels, in the given pose.
 *
 * `detail` overrides the size rule in both directions. Passing `true` under
 * `DETAIL_MIN` is a deliberate choice with a cost — everything below that size
 * is being asked to hold a 12-unit band under a 2-unit line — so the strokes
 * fatten to compensate, the same way the eyes do, and the caller owns the
 * result. The greeting's own full stop is the one place that asks for it.
 */
export function mascotGeometry(
  size: number,
  pose: MascotPose = "rest",
  detail?: boolean
): MascotGeometry {
  // A nonsense size is treated as the smallest one rather than throwing: this
  // runs while rendering a page, and a bad prop should degrade to a period.
  const px = Number.isFinite(size) && size > 0 ? size : 1;

  const eyeStroke =
    px >= 56 ? 3.3 : px >= 40 ? 3.5 : px >= 32 ? 3.7 : px >= 24 ? 4.4 : px >= 16 ? 5.2 : 5.6;
  const base = px >= 24 ? 6.5 : px >= 16 ? 7 : 7.5;
  const eyeDepth = pose === "asleep" ? base * ASLEEP_FLATTEN : base;
  const lean = pose === "walk" ? WALK_LEAN : 0;

  return {
    eyeStroke,
    eyeDepth,
    lipStroke: px >= 40 ? 2 : px >= 24 ? 2.6 : px >= 16 ? 3.4 : 4,
    ringStroke: px >= 40 ? 3 : px >= 24 ? 3.6 : px >= 16 ? 4.6 : 5.4,
    detail: detail ?? px >= DETAIL_MIN,
    leftX: EYE.leftX + lean,
    rightX: EYE.rightX + lean,
    tail: pose === "walk",
  };
}

/** One crescent, as a quadratic whose ends sit on `y` and whose belly lifts
    `depth` above them. `x` is the left end. */
export function eyePath(x: number, y: number, depth: number): string {
  return `M${x} ${y}q${EYE.span / 2} ${-depth} ${EYE.span} 0`;
}

/**
 * The drawing itself, as markup — everything inside the `<svg>` element.
 *
 * A string rather than JSX because the character has to reach the page two
 * ways: as `components/Mascot.tsx`, and injected into HTML that has already
 * been rendered from Markdown (the greeting's full stop, #159). One builder
 * feeds both, so there is one drawing on the site rather than a copy of it
 * written out wherever a string was needed.
 *
 * `id` names the mask and the clip. Two mascots in one document must not share
 * it: duplicate SVG ids resolve to whichever comes first, so the second one
 * would silently borrow the first one's eyes.
 */
export function mascotInner({
  size = 56,
  pose = "rest",
  id = "mascot",
  detail: force,
}: {
  size?: number;
  pose?: MascotPose;
  id?: string;
  detail?: boolean;
} = {}): string {
  const { eyeStroke, eyeDepth, detail, lipStroke, ringStroke, leftX, rightX, tail } =
    mascotGeometry(size, pose, force);
  const eyes = `${id}-eyes`;
  const body = `${id}-body`;
  const circle = `cx="${BODY.cx}" cy="${BODY.cy}" r="${BODY.r}"`;

  return [
    `<defs>`,
    // White keeps the body, black cuts the eyes out of it.
    `<mask id="${eyes}">`,
    `<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="#fff"/>`,
    `<g fill="none" stroke="#000" stroke-width="${eyeStroke}" stroke-linecap="round">`,
    `<path d="${eyePath(leftX, EYE.y, eyeDepth)}"/>`,
    `<path d="${eyePath(rightX, EYE.y, eyeDepth)}"/>`,
    `</g></mask>`,
    detail ? `<clipPath id="${body}"><circle ${circle}/></clipPath>` : "",
    `</defs>`,
    // The ring goes UNDER the fill, so only its outer half shows.
    detail
      ? `<circle class="mascot-ring" ${circle} fill="none" stroke="var(--mascot-line)" stroke-width="${ringStroke}"/>`
      : "",
    `<g mask="url(#${eyes})">`,
    `<circle ${circle} fill="var(--mascot-ink)"/>`,
    // Same ink, same group: the two shapes merge into one silhouette.
    tail ? `<path d="${TAIL}" fill="var(--mascot-ink)"/>` : "",
    detail
      ? `<path class="mascot-mouth" d="${MOUTH}" fill="var(--mascot-mid)"/>` +
        // Clipped, because the lip's two ends sit on the silhouette and its
        // stroke would otherwise poke out past it as two nubs.
        `<g class="mascot-lip" clip-path="url(#${body})">` +
        `<path d="${LIP}" fill="none" stroke="var(--mascot-line)" stroke-width="${lipStroke}"/>` +
        `</g>`
      : "",
    `</g>`,
  ].join("");
}

/** The whole element, for the places that need markup rather than a component. */
export function mascotSvg(
  options: {
    size?: number;
    pose?: MascotPose;
    id?: string;
    className?: string;
    detail?: boolean;
  } = {}
): string {
  const size = options.size ?? 56;
  const cls = options.className ? ` class="${options.className}"` : "";
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"` +
    `${cls} aria-hidden="true">${mascotInner(options)}</svg>`
  );
}

/**
 * Swap the final full stop of a rendered heading for the mascot.
 *
 * Operates on the FIRST `<h1>` of already-rendered Markdown, because the
 * sentence belongs to the vault and the vault is the owner's (`CLAUDE.md`
 * rule 1): `vault/Home/main.md` still says "Hey, I'm Kyrylo Leshchenko." and
 * always will. What changes is how that last character is drawn.
 *
 * Returns the html untouched when there is no h1, when the h1 carries markup
 * of its own, or when it doesn't end in a stop — the same refusal-to-guess the
 * intro's cues make. An h1 with a link or a bold word in it is a heading this
 * has no business rewriting.
 */
export function replaceFinalStop(html: string, markup: string): string {
  return html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, (heading) => {
    const open = heading.slice(0, heading.indexOf(">") + 1);
    const inner = heading.slice(open.length, -"</h1>".length);
    if (inner.includes("<") || !inner.endsWith(".")) return heading;
    return `${open}${inner.slice(0, -1)}${markup}</h1>`;
  });
}
