import {
  STAR_OFFSETS,
  STAR_BOX,
  STAR_PATH,
  STARS_WIDTH,
  ratingAriaLabel,
  ratingWidth,
} from "@/lib/stars";

/**
 * Monochrome 5-star rating. Supports halves (rating: 3.5).
 * Pure component — safe in both server and client components.
 *
 * Grey, not full text colour: a rating is metadata. On a shelf card it sits
 * under the title with the author line, and on an entry page it is a row of
 * the fact list — which is drawn by lib/markdown.ts, not by this component,
 * from the same geometry in lib/stars.ts. See the note there for why the half
 * star is a nested-svg clip rather than a per-star fill.
 */
export default function Stars({
  rating,
  size = 14,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const row = (fill: string) => (
    <g fill={fill}>
      {STAR_OFFSETS.map((x) => (
        <path key={x} d={STAR_PATH} transform={`translate(${x} 0)`} />
      ))}
    </g>
  );

  return (
    <svg
      role="img"
      aria-label={ratingAriaLabel(rating)}
      viewBox={`0 0 ${STARS_WIDTH} ${STAR_BOX}`}
      height={size}
      width={(size * STARS_WIDTH) / STAR_BOX}
      className={`inline-block align-[-0.1em] ${className}`}
    >
      {row("var(--border)")}
      {/* Nested viewport = the clip. No id, so a page full of ratings can't
          collide — see lib/stars.ts. */}
      <svg
        width={ratingWidth(rating)}
        viewBox={`0 0 ${STARS_WIDTH} ${STAR_BOX}`}
        preserveAspectRatio="xMinYMid slice"
      >
        {row("var(--text-tertiary)")}
      </svg>
    </svg>
  );
}
