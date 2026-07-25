import Link from "next/link";
import Stars from "@/components/Stars";
import T from "@/components/T";
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
      className={`group block ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] shadow-sm transition-shadow duration-300 group-hover:shadow-md ${
          item.isVideo ? "aspect-video" : "aspect-[2/3]"
        }`}
      >
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={item.title}
            className={
              item.coverFit === "contain"
                ? "h-full w-full object-contain p-6"
                : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            }
            loading="lazy"
          />
        ) : (
          /* Spine-style fallback cover */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {item.author ?? "—"}
            </span>
            <span className="text-sm font-semibold leading-snug text-[var(--text-secondary)]">
              {item.title}
            </span>
            <span className="h-px w-8 bg-[var(--border)]" />
          </div>
        )}
        {item.isVideo && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-[2px] transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-white">
                <path d="M8 5.14v13.72L19 12z" />
              </svg>
            </span>
          </span>
        )}
      </div>
      <span className="mt-2.5 block font-medium leading-snug text-[var(--text)]">
        <T en={item.title} uk={item.titleUk} />
      </span>
      {item.author && (
        <span className="mt-0.5 block text-sm leading-snug text-[var(--text-secondary)]">
          {item.author}
        </span>
      )}
      {showRating && typeof item.rating === "number" && (
        <Stars rating={item.rating} className="mt-1.5" />
      )}
    </Link>
  );
}
