import Link from "next/link";
import Stars from "@/components/Stars";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import type { ShelfItem } from "@/lib/shelf";

/**
 * One shelf card — a 2:3 cover, or a 16:9 thumbnail with a play badge for
 * videos. Shared by the medium rows on the section page and the grid on a
 * /<section>/type/<medium> page.
 *
 * `width` is a Tailwind class applied in rows (fixed-width flex children);
 * in a grid the card fills its cell and no width is passed.
 */
export default function ShelfCard({
  item,
  sectionSlug,
  className = "",
  showRating = true,
}: {
  item: ShelfItem;
  sectionSlug: string;
  className?: string;
  /** Off in the section rows — stars there make the rows noisy and uneven. */
  showRating?: boolean;
}) {
  return (
    <Link
      href={`/${sectionSlug}/${item.slug}`}
      className={`group press press-soft block ${className}`}
    >
      <div
        /* Video cards keep the thumbnail's native 16:9 — nothing is cropped.
           They're made smaller instead, by being sized from their own
           (shorter) height rather than the shared one; see `--shelf-video-h`
           in globals.css. */
        className={`relative overflow-hidden rounded-lg bg-[var(--surface)] shadow-sm transition-shadow duration-300 group-hover:shadow-md ${
          item.isVideo ? "aspect-video" : "aspect-[2/3]"
        }`}
      >
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            srcSet={item.coverSrcSet}
            /* Cover columns: roughly a third of a phone's width, and never
               wider than the fixed card on a desktop row. */
            sizes="(max-width: 640px) 33vw, 180px"
            alt={item.title}
            className={
              item.coverFit === "contain"
                ? "h-full w-full object-contain p-6"
                : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            }
            // Blur-up: the placeholder is the image's OWN background, so the
            // real cover paints straight over it with no JS and no swap.
            // Sizing mirrors object-fit or a letterboxed cover would sit on a
            // stretched blur. See lib/blur.ts.
            style={
              item.coverBlur
                ? {
                    backgroundImage: `url("${item.coverBlur}")`,
                    backgroundSize:
                      item.coverFit === "contain" ? "contain" : "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }
                : undefined
            }
            loading="lazy"
          />
        ) : (
          /* Spine-style fallback cover */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              <T en={item.author ?? "—"} uk={item.authorUk} />
            </span>
            <span className="text-sm font-semibold leading-snug text-[var(--text-secondary)]">
              <T en={item.title} uk={item.titleUk} />
            </span>
            <span className="h-px w-8 bg-[var(--border)]" />
          </div>
        )}
        {/* Overlaid on the cover so it reads at a glance while scanning a row,
            and costs no extra height under the title. */}
        {item.statusLabel && (
          <span className="shelf-status">
            <T {...item.statusLabel} />
          </span>
        )}
        {/* Opposite corner from the status badge, and client-only — see
            components/NewBadge.tsx. */}
        <NewBadge date={item.date} variant="cover" />
      </div>
      <span className="mt-2.5 block truncate font-medium leading-snug text-[var(--text)]">
        <T en={item.title} uk={item.titleUk} />
      </span>
      {item.author && (
        <span className="mt-0.5 block truncate text-sm leading-snug text-[var(--text-secondary)]">
          <T en={item.author} uk={item.authorUk} />
        </span>
      )}
      {showRating && typeof item.rating === "number" && (
        <Stars rating={item.rating} className="mt-1.5" />
      )}
    </Link>
  );
}
