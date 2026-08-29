"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  filterGroups,
  artistInitials,
  MUSIC_LANGS,
  type ArtistGroup,
  type MusicArtist,
  type MusicLang,
} from "@/lib/music-filter";
import { displayDate, displayDateUk } from "@/lib/dates";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { useLang } from "@/components/useLang";
import { ui, type Str } from "@/lib/ui-strings";

/**
 * The notes half of /music: a toolbar, then one card per artist.
 *
 * A CLIENT component, which the rest of the section page is not. The two
 * controls are local state rather than URL params — unlike the posts category
 * chips, which are links because a post's own chip has to be able to deep-link
 * back into the filtered list (#13). Nothing here links to a filtered view, a
 * half-typed query is not an address, and putting keystrokes in the URL would
 * fill the reader's history with them.
 *
 * The list is still in the static HTML: a client component is rendered on the
 * server for the initial paint, so crawlers and JS-off visitors get every
 * artist and every row — just without the box and the chips doing anything.
 */
export default function MusicNotes({
  sectionSlug,
  groups,
}: {
  sectionSlug: string;
  groups: ArtistGroup[];
}) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<MusicLang | null>(null);
  /* The placeholder and the label are ATTRIBUTES, so they can't be a <T> pair
     of spans — this is the one place a component has to know which language is
     showing. Same hook the command palette's search box uses. */
  const { lang: uiLang } = useLang();

  const { groups: shown, fuzzy } = useMemo(
    () => filterGroups(groups, { query, lang }),
    [groups, query, lang]
  );

  /* Only offer a language the page can actually show. With one note in a
     language the step is still worth having; with none it is a dead position
     in the cycle that answers with an empty list. */
  const langs = useMemo(() => {
    const seen = new Set<MusicLang>();
    for (const g of groups) for (const n of g.notes) for (const l of n.langs) seen.add(l);
    return MUSIC_LANGS.filter((l) => seen.has(l));
  }, [groups]);

  /* All → ENG → UA → RU → All. The button IS the control: one press moves one
     step and the label says where you are. A menu was the version before this
     and it was two interactions and a popover for four states. */
  const cycle = () => {
    const order: (MusicLang | null)[] = [null, ...langs];
    const at = order.findIndex((l) => l === lang);
    setLang(order[(at + 1) % order.length]);
  };

  const filtering = query.trim() !== "" || lang !== null;

  return (
    <>
      {/* Heading, search and the language button on ONE line, at every width.
          The heading is the only part allowed to give way: it wraps inside its
          own cell rather than pushing the controls to a second row. */}
      <div className="music-toolbar">
        <h2 className="music-toolbar-title">
          <T {...ui.notesOnHearing} />
        </h2>

        <div className="music-controls">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) setQuery("");
            }}
            placeholder={ui.musicSearch[uiLang]}
            aria-label={ui.musicSearchLabel[uiLang]}
            className="music-search"
            spellCheck={false}
          />

          {langs.length > 0 && (
            <button
              type="button"
              className="music-lang-button press"
              /* Stamped with the CURRENT value so the label paints blue and
                 gold while RU is the one selected — see globals.css. */
              data-lang-code={lang ?? undefined}
              aria-label={ui.musicFilterLangLabel[uiLang]}
              title={lang ? LANG_NAME[lang][uiLang] : ui.filterAll[uiLang]}
              onClick={cycle}
            >
              <span className="music-lang-value">
                {lang ? LANG_CODE[lang] : <T {...ui.filterAll} />}
              </span>
            </button>
          )}
        </div>
      </div>

      {fuzzy && (
        <p className="music-fuzzy-note">
          <T {...ui.musicFuzzy} />
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--text-tertiary)]">
          <T {...ui.musicNoMatches} />
        </p>
      ) : (
        shown.map((group) => (
          <ArtistCard
            key={group.key}
            group={group}
            sectionSlug={sectionSlug}
            /* While a filter is on, the arrival animation would replay on
               every keystroke — a list that flickers as you type. */
            animate={!filtering}
          />
        ))
      )}
    </>
  );
}

/** The button's labels are codes, identical in both languages. */
const LANG_CODE: Record<MusicLang, string> = {
  en: "ENG",
  uk: "UA",
  ru: "RU",
};

const LANG_NAME: Record<MusicLang, Str> = {
  en: ui.musicLangEn,
  uk: ui.musicLangUk,
  ru: ui.musicLangRu,
};

function ArtistCard({
  group,
  sectionSlug,
  animate,
}: {
  group: ArtistGroup;
  sectionSlug: string;
  animate: boolean;
}) {
  return (
    <section className="music-card">
      {group.cover && (
        /* The card's colour: this artist's newest cover, blurred past
           recognition and clipped to the card. Decorative — the same artwork
           is on a row below, where it carries a name. */
        <div className="music-wash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={group.cover} alt="" />
        </div>
      )}

      {group.artist && <ArtistHead artist={group.artist} />}

      {/* A track list, not the shelf's rows: square artwork, then the title
          and date on one line with the description under both. The divider is
          drawn from the TEXT column rather than the artwork's edge — see
          `.music-tracks` in globals.css. */}
      <ul className={`music-tracks ${animate ? "stagger" : ""}`}>
        {group.notes.map((note) => (
          <li key={note.slug}>
            <Link
              href={`/${sectionSlug}/${note.slug}`}
              className="press press-soft"
            >
              {note.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="music-art"
                  src={note.cover}
                  srcSet={note.coverSrcSet}
                  /* Never painted wider than 44px, at up to 3x. */
                  sizes="132px"
                  alt=""
                  width={44}
                  height={44}
                  /* Blur-up: the placeholder is the image's OWN background, so
                     the cover paints straight over it with no JS and no swap.
                     See lib/blur.ts. */
                  style={
                    note.coverBlur
                      ? {
                          backgroundImage: `url(${note.coverBlur})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                />
              ) : (
                /* No cover: an empty surface square, so every row keeps the
                   same text column and the dividers stay aligned. */
                <span className="music-art" aria-hidden="true" />
              )}

              {/* Title and label share one cell as a flex pair: the title
                  shrinks and ellipsises, the label never does. */}
              <span className="music-head">
                <span className="music-title">
                  <T en={note.title} uk={note.titleUk} />
                </span>
                <span className="music-format">
                  <span aria-hidden="true">·</span>
                  <T {...note.format} />
                </span>
              </span>

              {/* New sits with the DATE, not the title: it says when the note
                  arrived, which is the same kind of fact. Client-only — see
                  components/NewBadge.tsx. */}
              <span className="music-meta">
                <NewBadge date={note.date} />
                {note.date && (
                  <time dateTime={note.date} className="music-date">
                    <T
                      en={displayDate(note.date)}
                      uk={displayDateUk(note.date)}
                    />
                  </time>
                )}
              </span>

              {/* Placed by grid area, not by source order: the date shares the
                  title's line and the description runs the full width beneath
                  both. On a phone that's the difference between a readable
                  sentence and four words and an ellipsis. */}
              {note.description && (
                <span className="music-desc">
                  <T en={note.description} uk={note.descriptionUk} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Who the card is about — a round portrait, the name, and a sentence or two.
 *
 * Deliberately the shelf creator block's shape rather than a new one, so an
 * artist here and an author there read as the same kind of thing. Each field
 * degrades on its own: no photo falls back to initials, no bio leaves the name
 * standing alone.
 */
function ArtistHead({ artist }: { artist: MusicArtist }) {
  const { name, nameUk, bio, bioUk, photoUrl, photoBlur, photoSrcSet, href } =
    artist;

  /* The portrait and the name open the artist's People note when one exists,
     and are plain text when it doesn't — an artist nobody has profiled is the
     normal case, so its absence must not look like a broken control. The BIO
     is never a link: it is a paragraph, and a paragraph-sized target that
     navigates is a trap for anyone trying to select it. */
  const portrait = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      srcSet={photoSrcSet}
      /* 4rem, dropping to 3.25rem below 480px. The 256px variant covers both
         at 2x, which is what a phone wants either way. */
      sizes="64px"
      /* The name alone: the shape already says portrait, and the name is the
         next line of text. */
      alt={name}
      width={64}
      height={64}
      style={
        photoBlur
          ? {
              backgroundImage: `url("${photoBlur}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      loading="lazy"
    />
  ) : (
    <span className="artist-initials" aria-hidden>
      {artistInitials(name)}
    </span>
  );

  return (
    <div className="artist-head">
      {href ? (
        <Link
          href={href}
          className="artist-photo press press-soft"
          aria-label={name}
        >
          {portrait}
        </Link>
      ) : (
        <div className="artist-photo">{portrait}</div>
      )}

      <div className="artist-text">
        <p className="artist-name">
          {href ? (
            <Link href={href} className="artist-link press">
              <T en={name} uk={nameUk} />
            </Link>
          ) : (
            <T en={name} uk={nameUk} />
          )}
        </p>
        {bio && (
          <p className="artist-bio">
            <T en={bio} uk={bioUk} />
          </p>
        )}
      </div>
    </div>
  );
}
