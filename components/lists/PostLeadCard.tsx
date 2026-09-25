import Link from "next/link";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { ui } from "@/lib/ui-strings";
import { categoryLabel } from "@/lib/categories";
import { displayDate, displayDateUk } from "@/lib/dates";
import type { PostLead, PostRow } from "@/components/lists/PostListClient";

/**
 * The newest post, opened up at the head of the Posts page — page idea
 * `postsLead` (lib/site-config.ts, DECISIONS #180).
 *
 * The rows below say what each post is called; this says what the newest one
 * is LIKE, in its own first words and its own first picture, so the page
 * opens on something to read rather than an index to choose from. It is one
 * link, like a row, and it leaves the list (PostRows drops it there) so the
 * post isn't offered twice.
 *
 * No hooks — it renders inside PostRows on both sides of the Suspense
 * boundary, like everything else there.
 */
export default function PostLeadCard({
  sectionSlug,
  row,
  lead,
}: {
  sectionSlug: string;
  row: PostRow;
  lead: PostLead;
}) {
  const landscape =
    lead.imageW && lead.imageH ? lead.imageW / lead.imageH >= 1.1 : true;

  return (
    <Link
      href={`/${sectionSlug}/${row.slug}`}
      className={`idea-lead group press press-soft${lead.image ? "" : " is-text"}${
        landscape ? " is-landscape" : " is-portrait"
      }`}
    >
      {lead.image && (
        <span className="idea-lead-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead.image}
            srcSet={lead.imageSrcSet}
            sizes="(max-width: 640px) 100vw, 624px"
            width={lead.imageW}
            height={lead.imageH}
            alt=""
            style={
              lead.imageBlur
                ? {
                    backgroundImage: `url("${lead.imageBlur}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
        </span>
      )}
      <span className="idea-lead-text">
        <span className="idea-lead-eyebrow">
          <T {...ui.latestPost} />
          {row.date && (
            <>
              <span aria-hidden> · </span>
              <time dateTime={row.date}>
                <T en={displayDate(row.date)} uk={displayDateUk(row.date)} />
              </time>
            </>
          )}
          {row.category && (
            <>
              <span aria-hidden> · </span>
              <T {...categoryLabel(row.category)} />
            </>
          )}
        </span>
        <span className="idea-lead-title">
          <T en={row.title} uk={row.titleUk} />
          {row.draft && <span className="draft-chip">Draft</span>}
          <NewBadge date={row.date} />
        </span>
        {(lead.opening ?? row.description) && (
          <span className="idea-lead-opening">
            <T
              en={lead.opening ?? row.description}
              uk={lead.openingUk ?? lead.opening ?? row.descriptionUk ?? row.description}
            />
          </span>
        )}
        <span className="idea-lead-read action-link">
          <T {...ui.readPost} />
          <span className="arrow-glyph" aria-hidden>
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
