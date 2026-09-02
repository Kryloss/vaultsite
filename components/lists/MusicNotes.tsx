"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  filterGroups,
  flattenGroups,
  artistInitials,
  MUSIC_LANGS,
  type ArtistGroup,
  type MusicArtist,
  type MusicLang,
  type MusicSlide,
} from "@/lib/music-filter";
import Coverflow, { type CoverflowItem } from "@/components/Coverflow";
import T from "@/components/T";
import NewBadge from "@/components/NewBadge";
import { useLang } from "@/components/useLang";
import { ui, type Str } from "@/lib/ui-strings";

/**
 * The notes half of /music: a toolbar, then a COVER DECK.
 *
 * It was twenty-six stacked artist cards, one per artist, each holding a
 * portrait, a biography and — for all but three of them — a single track row.
 * That is a 7,000px page to say "twenty-nine records", and the artwork, which
 * is the only thing a music page has that a post list does not, was 44px wide
 * inside it. The deck inverts that: the covers are the page, at full size and
 * in Apple's own Cover Flow rake, and everything the cards used to carry moves
 * under the centred one — the record's own "At a glance" rows, then the
 * artist's portrait and biography.
 *
 * Still grouped by artist. `groupByArtist()` decides the order and
 * `flattenGroups()` only unrolls it, so an artist's records sit next to each
 * other in the deck exactly as they sat under one heading.
 *
 * A CLIENT component, which the rest of the section page is not. The two
 * controls are local state rather than URL params — unlike the posts category
 * chips, which are links because a post's own chip has to be able to deep-link
 * back into the filtered list (#13). Nothing here links to a filtered view, a
 * half-typed query is not an address, and putting keystrokes in the URL would
 * fill the reader's history with them.
 *
 * The deck is still in the static HTML: a client component is rendered on the
 * server for the initial paint, and every card is a real `<a href>` to its
 * note. Before hydration — and forever, with JS off — they lay out as a plain
 * wrapped row of covers rather than a 3D deck. See components/Coverflow.tsx.
 */
export default function MusicNotes({
  sectionSlug,
  groups,
}: {
  sectionSlug: string;
  groups: ArtistGroup[];
}) {
  /** Which cover the deck has centred — reported up by `Coverflow`, so the
      toolbar can show that record's artist beside its heading. */
  const [active, setActive] = useState(0);
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

  /* The deck: the surviving groups unrolled, in their group order. */
  const slides = useMemo(() => flattenGroups(shown), [shown]);

  /* Every biography the section holds, in both languages — the sizer for the
     artist slot above the deck. See `ArtistHead`. Built from the UNFILTERED
     groups on purpose: if it followed the filter, choosing a language would
     change which bio is the tallest and the slot would resize, which is the
     one thing it exists to prevent. */
  const allBios = useMemo(
    () =>
      groups
        .map((g) => g.artist)
        .filter((a): a is MusicArtist => Boolean(a?.bio))
        .map((a) => ({ en: a.bio as string, uk: a.bioUk })),
    [groups]
  );

  const items = useMemo<CoverflowItem[]>(
    () =>
      slides.map(({ key, note, artist }) => ({
        key,
        href: `/${sectionSlug}/${note.slug}`,
        src: note.cover,
        srcSet: note.coverSrcSet,
        blur: note.coverBlur,
        /* The card is artwork with no text on it, so the link's whole
           accessible name has to be built here. The artist is part of it: a
           list of twenty-nine record titles read aloud is not navigable. */
        label: artist
          ? `${localised(note.title, note.titleUk, uiLang)} — ${localised(
              artist.name,
              artist.nameUk,
              uiLang
            )}`
          : localised(note.title, note.titleUk, uiLang),
      })),
    [slides, sectionSlug, uiLang]
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

  return (
    <>
      {/* Heading, search and the language button on ONE line, at every width.
          The heading is the only part allowed to give way: it wraps inside its
          own cell rather than pushing the controls to a second row. */}
      <div className="music-toolbar">
        <h2 className="music-toolbar-title">
          <T {...ui.notesOnHearing} />
        </h2>

        {/* The centred record's artist, in the MIDDLE of the toolbar line on a
            wide window — the row is a three-column grid there so the portrait
            sits on its true midpoint rather than wherever the heading happens
            to end. `.music-artist` in globals.css hides this and shows the
            portrait inside the artist block instead once the row is too narrow
            to carry it. The box is always rendered, so the row keeps its shape
            when a note names an artist main.md has never heard of. */}
        <div className="music-artist" aria-hidden="true">
          {/* Not a link: this box is `aria-hidden`, and a focusable control
              inside hidden content is a trap for anyone tabbing. The artist's
              People note is still one press away from their name below. */}
          <ArtistPhoto artist={slides[active]?.artist} size={48} linked={false} />
        </div>

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

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--text-tertiary)]">
          <T {...ui.musicNoMatches} />
        </p>
      ) : (
        <Coverflow
          items={items}
          label={ui.musicDeck[uiLang]}
          onSelect={setActive}
          /* Whose record this is, above the deck; what the record is, below
             it. The artist heads the covers the way they used to head a card
             of rows — the grouping is still the page's spine (#103), it is
             just one artist at a time now. */
          header={(index) => (
            <ArtistHead artist={slides[index]?.artist} allBios={allBios} />
          )}
          caption={(index) =>
            slides[index] ? (
              <Caption slide={slides[index]} lang={uiLang} />
            ) : null
          }
        />
      )}
    </>
  );
}

/** The one place a bilingual pair has to collapse: an attribute, not a node. */
function localised(en: string, uk: string | undefined, lang: "en" | "uk") {
  return lang === "uk" && uk ? uk : en;
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

/**
 * What sits under the centred cover.
 *
 * The reference design's shape — title, one grey line, a narrow label/value
 * list. It is about the RECORD; the ARTIST heads the deck above it
 * (`ArtistHead`, handed to `Coverflow` as its `header`). Two sources, each
 * degrading on its own: the note's frontmatter, and the note's own "At a
 * glance" table (lib/music-facts.ts).
 *
 * The record's title carries `· Album` after it, which is the section's
 * established pairing (`Clancy · Album`); the artist's name is not repeated
 * here, because it heads the deck directly above.
 */
function Caption({ slide, lang }: { slide: MusicSlide; lang: "en" | "uk" }) {
  const { note } = slide;

  return (
    <>
      <p className="cf-title">
        <T en={note.title} uk={note.titleUk} />
        <span className="cf-format">
          <span aria-hidden="true">·</span>
          <T {...note.format} />
        </span>
        {/* The chip shape, not the music list's undressed one: here it really
            does follow a title in a row of text, which is what it is for. */}
        <NewBadge date={note.date} />
      </p>

      {note.description && (
        <p className="cf-desc">
          <T en={note.description} uk={note.descriptionUk} />
        </p>
      )}

      {note.facts && note.facts.length > 0 && (
        <dl className="cf-facts">
          {note.facts.map((fact) => (
            <div key={fact.label.en}>
              <dt>
                <T {...fact.label} />
              </dt>
              {/* Ellipsised to one line, so the tooltip is where a long album
                  title stays readable — the pattern `.toc-link` uses. An
                  attribute takes a string, so this is the one thing here that
                  has to know which language is showing. */}
              <dd title={fact.value[lang]}>
                <T {...fact.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/**
 * Who the record is by — the name and their description, under the portrait
 * that sits in the middle of the toolbar row.
 *
 * Deliberately the shelf creator block's shape rather than a new one, so an
 * artist here and an author there read as the same kind of thing. Each field
 * degrades on its own: no photo falls back to initials, no bio leaves the name
 * standing alone.
 *
 * It used to head a card of that artist's rows and hang off its top edge. It
 * now heads the DECK — one artist at a time, following whichever cover is
 * centred — and carries only the name and the description, because the
 * PORTRAIT lives in the middle of the toolbar row above it at every width.
 *
 * THE BIO IS SHOWN IN FULL, and the slot it sits in is exactly as tall as the
 * longest one the section holds. That is what `allBios` is for: every bio is
 * rendered into the same grid cell, all but the live one `visibility: hidden`,
 * so the cell is as tall as the tallest and the deck below it never moves.
 *
 * The alternative was clamping the bio to N lines and flooring it at N, and it
 * was tried first — but N depends on the width, on the language, and on
 * whatever bio the owner writes next, so it is three magic numbers that go
 * stale silently the first time a band gets a longer paragraph. The ghosts
 * cost ~13KB of text and no images (only the live block has a portrait), and
 * they are right at every width and in both languages without being told
 * anything.
 *
 * Rendered even when a note names no artist, so the slot keeps its height —
 * an unrendered header drops the whole deck.
 */
/**
 * An artist's portrait, at whatever size the place it sits in wants.
 *
 * ONE per page, in the middle of the toolbar row at every width. It briefly
 * lived in two places — the toolbar on a wide window, the artist block on a
 * narrow one — and that is gone: the block below is name and description now,
 * and the portrait is always the middle of the row above them.
 *
 * `linked` exists because the toolbar copy sits inside an `aria-hidden` box,
 * where a focusable control would be a trap for anyone tabbing; the artist's
 * People note is reached from their NAME instead.
 */
function ArtistPhoto({
  artist,
  size,
  linked = true,
}: {
  artist?: MusicArtist;
  size: number;
  linked?: boolean;
}) {
  if (!artist) return null;

  const inner = artist.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artist.photoUrl}
      srcSet={artist.photoSrcSet}
      /* The 256px variant covers every size this is drawn at, on any screen. */
      sizes="56px"
      /* The shape already says portrait, and the name is the next line of
         text — so the name alone, and nothing at all for the toolbar copy,
         which sits inside an `aria-hidden` box beside a heading that names
         the section rather than the artist. */
      alt={artist.name}
      width={size}
      height={size}
      style={
        artist.photoBlur
          ? {
              backgroundImage: `url("${artist.photoBlur}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      loading="lazy"
    />
  ) : (
    <span className="artist-initials" aria-hidden>
      {artistInitials(artist.name)}
    </span>
  );

  const style = { width: size, height: size };

  return linked && artist.href ? (
    <Link
      href={artist.href}
      className="artist-photo press press-soft"
      style={style}
      aria-label={artist.name}
    >
      {inner}
    </Link>
  ) : (
    <div className="artist-photo" style={style}>
      {inner}
    </div>
  );
}

function ArtistHead({
  artist,
  allBios,
}: {
  artist?: MusicArtist;
  allBios: { en: string; uk?: string }[];
}) {
  return (
    <div className="artist-head">
      <div className="artist-text">
        {/* Always a line, even with no artist to name: the slot holds its
            height or the deck under it moves. */}
        <p className="artist-name">
          {artist ? (
            artist.href ? (
              <Link href={artist.href} className="artist-link press">
                <T en={artist.name} uk={artist.nameUk} />
              </Link>
            ) : (
              <T en={artist.name} uk={artist.nameUk} />
            )
          ) : (
            "\u00A0"
          )}
        </p>

        {/* One grid cell holding the live bio and a hidden copy of every other
            one, so the cell is as tall as the longest the section has — at
            this width, in this language, with nothing measured. */}
        <div className="artist-bio-slot">
          {artist?.bio && (
            <p className="artist-bio">
              <T en={artist.bio} uk={artist.bioUk} />
            </p>
          )}
          {allBios.map((b, i) => (
            <p key={i} className="artist-bio artist-bio-ghost" aria-hidden="true">
              <T en={b.en} uk={b.uk} />
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
