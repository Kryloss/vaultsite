# Plan — the book shelf becomes a shelf

Status: **not started.** Written 2026-08-24, after the /music redesign.
Delete this file once it ships and the reasoning has moved to `docs/DECISIONS.md`.

Plans live in `docs/plans/` because they are transient: they describe work that
has not happened yet, and they are wrong the moment it does. The five documents
at `docs/` root are permanent references and stay there.

## Why

The section is called **Shelf** and renders as Netflix rows. Netflix is a fine
grammar for "what's new", but it is the same strip every site has, and it is
the wrong one for eleven books — a paperback is not a poster.

`/shelf/type/book` is currently the same grammar again, one size larger: a grid
of the same cards the section page already showed in a row. It duplicates
rather than adds.

This is the /music method applied to books (`docs/DECISIONS.md` #103):

1. **Borrow the grammar the medium owns.** For music that was Apple Music; for
   books it is a bookcase, which is older and more universal than any app.
2. **Group by what the reader thinks in.** Music grouped by artist. Books are
   already grouped by medium and category — that part is done, so the win here
   is the second half of the method, not this one.
3. **Colour comes from the content, never from the site.** The music wash
   borrowed the record's cover. A spine borrows the book's cover. `--accent`
   stays deleted (#64) because in neither case is the colour ours.

## Scope

**Changes:** the grid on `/shelf/type/book` and its category pages
(`/shelf/type/book/fiction`, …) becomes a row of standing spines.

**Does not change:**

- The section page (`/shelf`). Its medium rows stay Netflix-style, face-on.
  The site then shows books both ways on purpose: **rows are faces, the shelf
  is spines**, and the medium page becomes a genuinely different object rather
  than a bigger copy of the row.
- Movies, shows and videos. A poster is meant to be seen face-on and nobody's
  mental model of a DVD is its spine. `ShelfTypeView` keeps the grid for every
  medium except `book`.
- The entry page, the quotes view, the chips, the filtering, the URLs.

**The accepted loss:** at browse level a book's cover art then appears only on
the section page's row. That art was sourced with effort. It is acceptable
because the cover still opens the entry page and still carries every OG card —
and because the medium page earning its own identity is the entire point.

## The design

### Geometry

| Token | Value | Why |
|---|---|---|
| `--spine-w` | 44px (38px < 480px) | Fits ~11 spines plus gaps inside the 39rem column with room to grow. |
| `--spine-h` | 196–232px, derived | See below. |
| gap | 3px | Books touch on a real shelf; 3px keeps the hairlines distinct. |

Spines sit on **one `--border` hairline** — that is the whole shelf. No wood,
no ledge, no shadow-under-the-plank: the books supply the colour and the
furniture supplies none, which is the same discipline as `.music-wash`.

Heights vary **upward from the baseline**, derived from the cover's own aspect
ratio (`h / w`, already in `.image-manifest.json`): a tall cover becomes a tall
book. Map `ar` 1.30→1.70 onto 196→232px, clamped.

> **Check this first in the mockup.** A cover's aspect is sometimes a scan
> artifact rather than the physical book, and if the variation reads as random
> rather than as a shelf, drop it and make every spine 214px. Uniform is better
> than arbitrary. **Do not substitute a random or hash-based height** — it
> would look identical and mean nothing.

Spine **width stays uniform**. Thickness would want a page count and we do not
have one; inventing it is the same mistake as a random height.

### Colour

`--spine-bg` is the cover's dominant colour, clamped into a legible band.
`--spine-fg` is near-white or near-black, chosen from the clamped lightness.

Every spine also carries `1px solid color-mix(in srgb, var(--text) 12%,
transparent)`. One rule, both jobs: it separates adjacent books, and it keeps a
near-white spine from dissolving into a light page.

The colour does **not** flip with the theme. It belongs to the book. Contrast
is internal to the spine (fg on bg), so the page's ground does not enter into
it — which is why one value is enough for both themes.

### Type

Title runs **top-to-bottom** (`writing-mode: vertical-rl`, no transform),
the North American convention and the option with no rotation to get wrong.
(Bottom-to-top is the European convention; if it is preferred, add
`transform: rotate(180deg)` and check Cyrillic in both languages.)

- Real text, so it stays selectable, searchable and screen-readable. Never an
  image of words.
- Author follows the title in `--spine-fg` at reduced opacity, same column.
- Overflow ellipsises (works in vertical writing mode) with the full string in
  `title=`, the same treatment `.toc-link` gets.

### States

| State | Treatment |
|---|---|
| hover | lifts 8px, the way you pull a book out |
| `status: reading` | sits 14px proud **at rest** — what people actually do with a book they are partway through |
| New | small dot at the head of the spine, not the cover pill |
| rating | **dropped on this view.** No room, and only 1 of 16 notes is rated. Stars stay on the entry page. |
| no cover | `--surface` ground with the standard border — see traps |

The reading lift is positional, so it is invisible to a screen reader: keep the
existing `statusLabel` as `sr-only` text inside the spine.

## Data: the dominant colour

One new optional field in `.image-manifest.json`, written by
`scripts/sync-assets.mjs` in the same pass that writes `blur`:

```
"/vault-assets/Shelf/Books/covers/sapiens.jpg": { "w":…, "h":…, "blur":…, "dom": "#7a5c3f" }
```

Extraction, after the existing `blur` step, reusing the same `sharp` handle:

1. `.resize(8, 8, { fit: "cover" }).raw().toBuffer()` — 64 pixels.
2. Drop near-white and near-black pixels (they are paper and ink, not the
   book's colour).
3. Bucket the rest by hue, take the largest bucket, average inside it.
   A flat average across all 64 turns every colourful cover into mud.
4. Clamp lightness into the legible band and emit hex.

Start in **HSL** — about ten lines and adequate. Move to OKLCH only if the
spines look unevenly bright side by side, which is the failure HSL has.

Like `blur` and `srcset`, this is **a nicety and never a build blocker**: if
`sharp` is missing or the image is unreadable, the field is simply absent and
the spine falls back.

## Files

| File | Change |
|---|---|
| `scripts/sync-assets.mjs` | emit `dom` (above) |
| `lib/blur.ts` | `ImageMeta.dom?: string`, `domFor(url)` |
| `lib/spine.ts` | **new, pure**: clamp, fg-from-bg, height-from-aspect |
| `lib/spine.test.ts` | **new** — see Tests |
| `lib/shelf.ts` | `ShelfItem.coverDom?: string` populated in `toShelfItem()` |
| `components/lists/BookSpines.tsx` | **new** — the shelf itself |
| `components/lists/ShelfTypeView.tsx` | render `BookSpines` when `group.slug === "book"`, grid otherwise |
| `app/globals.css` | `.book-shelf` / `.book-spine` block at the foot |
| `lib/ui-strings.ts` | any new fixed string, as a `{en, uk}` pair |

## Phases

Each phase is shippable on its own — which matters, because Obsidian Git
auto-commits and Vercel deploys on a timer.

0. **Mockup first**, against the real eleven books, exactly as /music was
   mocked before it was built. Settle the height question and the
   top-to-bottom question here, not in code.
1. `dom` in the manifest + its test. Ships invisibly; nothing renders
   differently.
2. `lib/spine.ts` + tests. Still nothing rendered.
3. `BookSpines.tsx` + CSS, wired in for books only.
4. Polish: reading lift, New dot, reduced motion, phone sizing, focus ring.
5. Docs (below).

## Traps specific to this repo

- **`.stagger` must stay on the `<ul>`.** `j`/`k` keyboard navigation finds
  rows through it, and every list on the site already carries it.
- **Compose with `.press`, do not override it.** `.press` owns `transform` and
  declares its own transition. Put the lift in a variable
  (`--spine-lift`) that composes into the same transform chain, the way
  `.lightbox-arrow` and `.selection-pill` do.
- **`globals.css` has no `@layer`.** The new block goes at the foot, below
  anything it overrides, and must not set `position`/`display`/`width` on a
  class whose element also carries a Tailwind utility for it (#81).
- **No cover, or a remote `cover: https://…`** → `imageMeta()` returns
  undefined → no `dom`. The fallback spine must be designed, not discovered:
  `--surface` ground, `--text-secondary` type, same border. Today every book
  has a local cover, so **the vault will not exercise this path** — test it.
- **Focus must be visible on a spine.** A `--text` ring, per the design system.
- **`prefers-reduced-motion`** removes the lift transition (the offset itself
  can stay — it is position, not motion).
- **Both languages.** Ukrainian titles are longer and run vertically too;
  check the ellipsis and the 38px phone width in `.lang-uk`.

## Tests

`npm test` covers `lib/*.test.ts` and `scripts/*.test.mjs`, so both halves are
testable without a framework.

`lib/spine.test.ts`:

- lightness clamp keeps a black cover and a white cover both inside the band
- fg flips to near-black above the threshold and near-white below
- height mapping is monotonic and clamps at both ends
- **an item with no `dom` returns the fallback** — the path the vault has no
  content for

`scripts/dominant-colour.test.mjs`: a synthetic buffer (a red square with a
white border) yields red, not pink — i.e. the near-white drop works.

## Docs to update when it ships

- `docs/DECISIONS.md` — a new numbered entry: why the medium page stopped
  duplicating the section row, why colour from a cover does not reopen #64, and
  whichever of the two open questions got settled. **Note:** `#104` is
  currently used twice; renumber before appending.
- `CLAUDE.md` **and** `AGENTS.md`, in the same change — the shelf paragraph in
  both describes the grid.
- `docs/ARCHITECTURE.md` if the design system gains tokens.
- Delete this file.

## Open questions for Kyrylo

1. **Top-to-bottom or bottom-to-top** spine text?
2. **Do category pages get spines too**, or only the unfiltered "All" view? A
   shelf of three books is still a shelf, so spines everywhere is the simpler
   answer — but it is his call.
3. **Losing the covers at browse level** on the medium page — agreed?

## Considered and rejected

- **A grid/shelf toggle.** A hedge, and hedges are how pages accumulate
  controls nobody uses. Commit to one.
- **Wood, paper texture, a drop shadow under a plank.** Skeuomorphism on a
  monochrome site. The hairline is the shelf.
- **Cover-on-hover over the spine.** Two objects fighting for the same space,
  and it would duplicate the link preview card that already exists for prose.
- **Spine thickness from a page count.** No such data, and a guessed thickness
  is a lie about a real object.
