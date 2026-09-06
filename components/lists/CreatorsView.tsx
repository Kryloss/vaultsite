import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { gameCount } from "@/lib/plural";
import { creatorInitials } from "@/lib/shelf";
import {
  sortCreatorsForTop,
  type ShelfCreatorGroup,
} from "@/lib/shelf-creators";

/**
 * The Studios chip's page: every studio on the medium, RANKED, each a link to
 * its own shelf (DECISIONS #139, #142).
 *
 * It is the Top list's grammar and its actual markup — `.top-list`, rank
 * column, art column, title over description, figure on the right. Two
 * ranked lists one chip apart should not be two designs, and the row that
 * ranks games and the row that ranks the people who made them are the same
 * kind of object: a position, a picture, a name, a line, a number.
 *
 * A LIST, never a grid of covers. The artwork here belongs to the games, and
 * putting one game's cover beside a studio's name would be choosing their
 * best on the reader's behalf — which is exactly what the figure on the right
 * refuses to do as well.
 *
 * The portrait is ROUND where a game's cover is a rectangle, because it is a
 * portrait: every other picture of a maker on this site is a circle (#86).
 */
export default function CreatorsView({
  sectionSlug,
  mediumSlug,
  creators,
}: {
  sectionSlug: string;
  mediumSlug: string;
  creators: ShelfCreatorGroup[];
}) {
  const ranked = sortCreatorsForTop(creators);

  return (
    <>
      <p className="mt-6 text-sm text-[var(--text-tertiary)]">
        <T {...ui.studiosLead} />
      </p>

      <ol className="stagger top-list mt-4">
        {ranked.map((group, i) => {
          const { creator } = group;
          return (
            <li key={group.slug} className="top-slot">
              <Link
                href={`/${sectionSlug}/type/${mediumSlug}/${group.slug}`}
                className="top-row press press-soft"
              >
                <span className="top-rank" aria-hidden>
                  {i + 1}
                </span>

                {creator.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.photoUrl}
                    srcSet={creator.photoSrcSet}
                    /* 44px, the rank list's own art column — so the 256w
                       variant is the pick here exactly as it is for a cover,
                       and no second file is fetched for this page. */
                    sizes="44px"
                    alt=""
                    aria-hidden
                    className="top-art top-art-round"
                    style={
                      creator.photoBlur
                        ? { backgroundImage: `url("${creator.photoBlur}")` }
                        : undefined
                    }
                    loading="lazy"
                  />
                ) : (
                  /* Keeps the column filled so a studio with no portrait
                     still lines its name up with every row above it. */
                  <span className="top-art top-art-round top-art-empty">
                    <span className="creator-initials" aria-hidden>
                      {creatorInitials(creator.name)}
                    </span>
                  </span>
                )}

                <span className="top-title">
                  <T en={creator.name} uk={creator.nameUk} />
                </span>

                {/* What the list is ranked on, in the column the games list
                    puts its rating in — so the figure that explains the order
                    is where a reader of the other list already looks. */}
                <span className="top-rating">
                  <span className="top-count">
                    <T {...gameCount(group.items.length)} />
                  </span>
                </span>

                {creator.bio && (
                  <span className="top-desc">
                    <T en={creator.bio} uk={creator.bioUk} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
