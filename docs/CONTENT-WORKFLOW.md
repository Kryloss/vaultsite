# Content intake workflow (for AI assistants)

Kyrylo gives you raw content — a half-written post, thoughts on a book, notes
about a project. Your job: structure it, wire it into the site, and add it to
the vault. This doc is the playbook. Read CLAUDE.md first for the hard rules.

## The contract

1. **His words stay his.** Light touch only: fix typos, grammar, and obvious
   errors; break walls of text into paragraphs/sections; never rewrite
   phrasing, tone, or opinions. Don't "improve" jokes. If a sentence is
   confusing beyond a small fix, ask instead of rewriting.
2. **Ask only when genuinely ambiguous.** Use defaults (below) for everything
   else. Good reasons to ask: unclear which section it belongs to, a new
   category would be created, a factual gap (missing date, wrong-looking
   name), or intent you can't infer. Bad reasons: anything a sensible default
   covers.
3. **Publish directly.** No `draft: true` unless he says "draft". Files go
   live on his next Obsidian Git sync.
4. **Never break conventions.** Frontmatter keys, folder structure, and slugs
   follow this doc exactly. When done, sanity-check your YAML (a missing
   closing `---` breaks the build).

## Step by step

1. **Classify** → which section? Posts (writing/opinions/TILs), Shelf (books,
   movies, shows, YouTube videos), People (profiles), Projects (things he
   built), Music (album/track thoughts), Now (rare — current-status updates
   edit `Now/main.md` in place).
2. **Clarify** → only if rule 2 triggers. Batch all questions at once.
3. **Structure** → apply the matching template below.
4. **Cross-link** → scan the new text AND existing notes for link
   opportunities (see wiki rules). This is a big part of your value.
5. **Source images** → covers for Shelf/People items, the creator portrait for
   a Shelf item (`author_photo:` — see the creator block above), inline figures
   where they help (see "Images & media sourcing" below). Don't skip this step.
6. **Write the file** → `vault/<Section>/<Natural Title>.md`. File name = the
   title in normal words (spaces fine, no slashes/colons); the engine slugs it.
   Where a section has subfolders, use the matching one — a book goes in
   `vault/Shelf/Books/`, a film in `Movies/`, a series in `Shows/`, a YouTube
   note in `Videos/` — with its cover in that folder's `covers/` and the
   creator's portrait in the shared `vault/Shelf/creators/`. Media for a
   post goes in `vault/Posts/attachments/`, diagrams in
   `vault/Projects/attachments/`, scaffolding notes in `vault/Posts/Examples/`.
   Subfolders never change a URL (`Shelf/Books/Sapiens.md` is still
   `/shelf/sapiens`), so file by meaning.
7. **Report** → tell him the file path, the URL it will get, links added,
   images fetched (with their sources), any creator left on the initials
   fallback and why, and anything you fixed or assumed.

## Defaults

- `date:` today (his timezone; YYYY-MM-DD).
- `category:`/`categories:` reuse an existing one when it fits (grep other
  entries); ask before inventing a new one. See Categories.
- `description:` write one — a single sentence in his voice, no marketing tone.
- `cover:`/images: if he mentions an image he'll add later, include the
  commented line: `# cover: name.jpg   ← drop into the section's covers/ folder and uncomment`.
- Titles: his working title if he gave one; otherwise derive from content, plain
  and specific — nothing clickbaity.

## Templates

### Post — `vault/Posts/<Title>.md`
```md
---
title: <Title>
date: YYYY-MM-DD
category: <existing category>
description: <one sentence>
---
<his text, structured with ## headings if long>
```

### Shelf item — `vault/Shelf/<Books|Movies|Shows|Videos>/<Title>.md`
```md
---
title: <Title>
author: <author / director / creator / channel>
author_uk: <the name in Ukrainian — omit for a channel name that isn't translated>
author_photo: <slug>.jpg   # into vault/Shelf/creators/ — see Creator block below
# author photo: Wikimedia Commons — <author>, <licence>
author_bio: >-
  <one or two sentences about them — see Creator block below>
author_bio_uk: >-
  <the same, in Ukrainian>
medium: book | movie | show | video
categories: [<one or more — see the vocabularies below>]
rating: <0–5, halves allowed — ONLY if he gave one; never invent his rating>
date: YYYY-MM-DD
description: <one sentence>
cover: <slug>.jpg          # videos: omit — the thumbnail comes from `video:`
video: <youtube url>       # medium: video only
---
| | |
|---|---|
| Published | … |
| One-liner | … |

## Why it's on the shelf
<his thoughts>

## Quotes
<his quotes as blockquotes — NEVER add quotes from the work yourself; if he
provides none, omit this section or leave a placeholder he can fill>
```

See **Categories** below — Shelf, Posts and People all use the same key.

#### The creator block — every shelf note, no exceptions

Above the fact table, a shelf entry page renders a round portrait,
the role, the name and a short bio (`components/Creator.tsx`, DECISIONS #86).
Filling it is part of writing the note, not an optional polish step.

- **The role label is NOT written in the note.** It comes from `medium:` —
  book → Author, movie → Director, show → Creator, video → Channel — in both
  languages. Don't add a `role:` key; there isn't one.
- **A shelf note has NO `## At a glance` heading.** Its body opens straight
  with the `| | |` table. The heading was deleted from every shelf note and
  its `.uk.md` — a two-word label over three rows of facts, one line under a
  creator block, announcing nothing the rows don't say themselves
  (`docs/DECISIONS.md` #87). **People notes keep theirs**; this is a
  shelf-only convention.
- **Keep the `| | |` header row empty.** That empty header is what makes the
  block render as a quiet fact list instead of a bordered data-table card.
  Putting words in it switches the card back on.
- **Never leave the creator row in the fact table.** The block prints the name
  already, so a `| Author | … |` row below it is the same fact twice. If the
  row carried a detail beyond the name (an alternate spelling, a pen name),
  move that detail into the bio rather than losing it.
- **`author_bio:` is one or two sentences, and every clause has to be true.**
  Nationality, profession, the institution they're at, the thing they're best
  known for, dates for a dead writer. Verify it the same way a People note is
  verified — Wikipedia in any language, an official page — and if you can't,
  leave the key out. A missing bio renders cleanly; an invented one is a
  factual error on a page that looks authoritative. No `## Sources` section is
  needed for two sentences of this kind, which is the one thing that separates
  it from a People note.
- **Write it about the person, not the work.** The note already says what the
  book is; the block says who was holding the pen. A sentence that could be
  swapped between two of Kyrylo's shelf notes isn't worth the space.
- **`author_uk:` where the name is normally transliterated** (Ювал Ной Харарі),
  and omitted where it isn't — a YouTube channel keeps its Latin name in both
  languages. If the note's `.uk.md` already spells the name somewhere, reuse
  that spelling exactly rather than picking your own.
- **`author_photo:` is optional, but work the cascade before giving up.** Every
  creator on the shelf today has one, including two YouTube channels and an
  author with no Wikipedia photo — see "Images & media sourcing" for the order
  to try, which is longer than it looks. If it genuinely runs out, initials are
  a finished state, not a gap; never reach for a worse source to avoid them.

### Video shelf item — `vault/Shelf/Videos/<Title>.md`

Same template as above with `medium: video`. Differences worth knowing:

```md
---
title: <exact video title, as YouTube has it>
title_uk: <translated title>
author: <channel name>
author_bio: >-
  <one or two sentences about the channel — see Creator block below>
author_bio_uk: >-
  <the same, in Ukrainian>
medium: video
categories: [Tech, Education]
video: https://www.youtube.com/watch?v=<id>
uploaded: YYYY-MM-DD      # the VIDEO's publish date, from YouTube — ask if unsure
date: YYYY-MM-DD          # the day it went on the shelf
description: "<one sentence>"
description_uk: "<one sentence>"
---
| | |
|---|---|
| Topic | … |
| Released | <the video's upload date — NOT the day he watched it> |

<the video URL, alone on its own line — it becomes an embedded player>

## Why it's on the shelf
<his thoughts — leave an HTML comment placeholder if he gave none>
```

- **No `cover:`.** The thumbnail is derived from the video ID at build time.
- **Get the title and channel from the horse's mouth**, not from a search
  result — YouTube's oEmbed endpoint is keyless and exact:
  `https://www.youtube.com/oembed?url=<video url>&format=json`
- **`Released` is the upload date, and so is `uploaded:`.** oEmbed does NOT
  return it and watch pages don't fetch cleanly, so it usually can't be
  verified from here. Leave both blank and ask him rather than guessing — and
  never quietly reuse today's date, which is the day *he* watched it, not the
  day it went up. The frontmatter key earns its keep: with `uploaded:` the page
  ships a full `VideoObject` and can appear as a video result in Google;
  without it the note falls back to a plain `CreativeWork` (DECISIONS #41).
- The row layout uses 16:9 cards for videos; nothing else needs configuring.

### Person — `vault/People/<Full Name>.md`
```md
---
title: <Full Name>
title_uk: <transliterated name>
date: YYYY-MM-DD
categories: [<optional — see Categories below>]
description: <one-line who-they-are>
# cover: <name>.png   ← square photo into vault/People/ and uncomment
---
## At a glance
| | |
|---|---|
| Born | … |
| Known for | … |

## Why <first name>
<his reasons>

## Sources

- <2–4 links used to verify the facts>
```

### Project — `vault/Projects/<Title>.md`
Same frontmatter as a post (no category needed). Remember: the section page
shows the first ~1000 characters inline, so front-load the interesting part.

### Music note — `vault/Music/<Title>.md`
Post frontmatter. An Apple Music link pasted on its own line becomes a player —
keep any he provides on separate lines.

## Series — notes that are one arc

When a note continues an earlier one, give both the same `series:` name:

```yaml
series: Road to Security+
series_uk: Шлях до Security+   # write this on ONE part only
part: 2                        # only if date order is wrong
```

The name is matched literally (case and spacing aside) — a typo makes a second
series, so copy it from the existing part rather than retyping it. Order is
oldest-first automatically; `part:` is for same-day publications or a note
written out of order. Ukrainian bodies are `.uk.md` files with no frontmatter,
so `series_uk:` goes in the English file like every other `_uk` key.

Ask before inventing a series. Two notes on the same topic aren't necessarily
parts of one — a series says *read these in order*, and applying it to a pair
of standalone posts tells the reader the first one is required reading when it
isn't.

## Categories

Shelf items, posts and people all take the same frontmatter key. It is
multi-valued — an entry appears under every category it lists:

```yaml
categories: [Tech, Education]
categories: Tech, Education     # comma-separated works too
category: Cybersecurity         # a single value; posts use this form
```

Where they show up:

| Section | On the entry page | On the section page |
|---|---|---|
| Shelf | chips above the date → `/shelf/type/<medium>/<category>` | chips on each medium page; the shelf front page shows none |
| Posts | chips above the date → `/posts?category=<name>` | filter chips |
| People | chips above the date → `/people?category=<name>` | filter chips |

Only the shelf's categories are real pages. Posts and People filter from a
query string in the browser (decision #14), which means those filtered views
aren't crawlable, have no page of their own, and don't work with JS disabled.
Nothing to do about it when writing content — just don't expect
`/posts?category=X` to behave like a permanent URL.

**Naming.** Reuse an existing name where it fits (grep other entries) rather
than inventing a near-duplicate — "Sci-Fi" and "Science Fiction" would become
two separate chips. Starting vocabularies:

| Section | Categories |
|---|---|
| video | Entertainment, Politics, Tech, Education, Music, PopSci |
| movie | Sci-Fi, Thriller, Drama, Action, Comedy, Documentary |
| show | Drama, Thriller, Comedy, Sci-Fi, Documentary, Anime |
| book | Nonfiction, Fiction, History, Science, Tech, Biography |
| post | Cybersecurity, Meta (`Meta` = posts about the site itself) |
| person | none established yet — ask before starting one |

Genre and topic classification is factual, so assign these yourself — unlike
`rating:`, which is his and never invented.

**Always English in frontmatter.** Ukrainian names live in `CATEGORY_LABELS`
(`lib/categories.ts`) and apply everywhere a category is shown. A category
missing from that file falls back to the English string in both languages, so
add an entry there whenever you introduce a new category. URL slugs are built
from the English name, so adding a translation never changes an address.

## Images & media sourcing

Fetch images automatically — Kyrylo shouldn't have to hunt for covers.

**Preferred: download into the vault.** Save the file next to the note
(`vault/Shelf/Books/covers/sapiens.jpg`), set `cover: sapiens.jpg` — the file
name is enough, the engine finds it anywhere in the vault. Vault files show up in
Obsidian, sync through git, and never rot. Ask permission before downloading,
batched in one line ("Downloading 2 covers: sapiens.jpg from Open Library
(~60 KB), mykhailo-fedorov.jpg from Wikimedia Commons (~120 KB) — OK?").

**Fallback: remote URL.** If a download isn't possible in the session, set
`cover: https://…` — the site renders it directly. Flag it in your report so
he knows it's a hotlink that could rot.

**Search cascade — exhaust it before giving up.** Work down each chain until
something usable appears; a failed first source is normal, an empty report
after one attempt is not.

| Content | Cascade (in order) |
|---|---|
| Book covers | 1. Open Library by ISBN (`covers.openlibrary.org/b/isbn/<ISBN>-L.jpg`, keyless — try multiple editions' ISBNs) 2. Open Library search API → cover ID 3. publisher page |
| Movie/show art | 1. en-Wikipedia REST summary (`/api/rest_v1/page/summary/<Title>`) 2. `action=query&prop=pageimages` 3. season/franchise pages 4. other-language Wikipedias (de, fr, uk — often expose the poster when en doesn't) 5. Wikidata claims P18 (image) / P154 (logo) 6. `page/media-list` → Commons-hosted logo, used with `coverFit: contain` 7. typographic fallback tile + tell him |
| People photos | 1. Wikimedia Commons ONLY (verify license; note author + license as a comment in the note) 2. official government/company portrait pages. Never anything else |
| Shelf creator portraits (`author_photo:`) | 1. Wikimedia Commons by name, in ANY language's Wikipedia 2. Commons file search 3. the creator's own official site / publisher / studio page 4. **for a `medium: video` note only:** the channel's own YouTube avatar. Never anything else — and no photo is still a fine answer |
| Music artwork | Not needed — Apple Music embeds carry their own art |
| Inline figures | Wikimedia Commons, official docs/press kits, his own screenshots |

**Wide art (logos, banners):** set `coverFit: contain` in the entry frontmatter
— the card letterboxes it on the tile background instead of cropping. This is
how a freely-licensed title logo becomes a perfectly good cover when no poster
is available (see `vault/Shelf/Shows/Mr Robot.md`).

**Work the cascade properly — three of the four "no portrait" cases were the
first source giving up too early.** In order:

1. **English Wikipedia's `pageimages` is not the answer, it's the first
   guess.** It returns whatever sits in the infobox, which for Richard Bach is
   his *signature*. When that comes back looking wrong, try other languages:
   `pl`, `nl`, `uk`, `de`, `fr`, `es` all have their own editorial choices, and
   `pageimages` on each is one more keyless call.
2. **Then search Commons directly** (`list=search&srnamespace=6`). A portrait
   often exists under a name nobody links from the article — Bach's is filed
   under the 1970 film shoot he was photographed at.
3. **Confirm a suspicious file before using it.** That Bach photo is captioned
   as two people. `prop=globalusage` settles it: the cropped version is the
   infobox portrait on about twenty Wikipedias, which is twenty communities
   agreeing it's him. Do this whenever a file could be someone else — a
   misidentified face is worse than initials.
4. **The creator's own official site.** Andrey Doronichev has no Commons photo
   and a personal site with a portrait on it; that's the sanctioned
   "official page" step, and the credit line says where it came from.
5. **A YouTube channel: use the channel's own avatar.** Keyless, two requests,
   exact — no searching and no guessing at identity:

   ```
   https://www.youtube.com/oembed?format=json&url=<video url>   → author_url
   GET <author_url>  →  <meta property="og:image" content="…">
   ```

   The channel page's `og:image` **is** the avatar, served at 900×900 and
   already square. This is the right source rather than a portrait of the
   host: `author:` names the *channel*, so a photo of Marques Brownlee under
   the byline "WVFRM Podcast" is the wrong picture with the right face — the
   Waveform logo is what that channel actually looks like. A channel avatar is
   the channel's own identifying artwork, used to identify the channel, which
   is the same footing as a book cover or a poster. Credit it as
   `# author photo: the channel's own avatar, youtube.com/@handle`.

**Creator portraits go in one shared folder, square-cropped on the way in.**
Save to `vault/Shelf/creators/<name-slug>.jpg` — one folder for the whole
shelf, not per-medium `covers/` folders, because the asset index is keyed by
file name across the entire vault and an author who appears under two mediums
would otherwise be two copies of one file. Then:

1. **Take the ~400px thumbnail, not the original** — `iiurlwidth=400` on the
   Commons `imageinfo` query. The block paints at 72px.
2. **Crop to the face yourself.** These are stage shots, conference stills and
   press photos; a centred square crop puts about half of them off-frame. Look
   at the picture, pick the box, write out 320 × 320. Doing it here rather
   than with `object-fit` also strips EXIF and keeps each file ~20 KB.
3. **Record the credit** as a `# author photo: Wikimedia Commons — <artist>,
   <licence>` comment directly under `author_photo:`, exactly as covers do.
4. **A duo or a group is fine** — the Kapranov Brothers are two people and the
   crop keeps both. Don't substitute one member for the whole.
5. **Never substitute a related person.** A podcast channel is not its host: if
   `author:` says "WVFRM Podcast", a portrait of Marques Brownlee is the wrong
   picture with the right face — take the channel's avatar (step 5 of the
   cascade above), or initials.

**Note:** some APIs are flaky or geo-filtered from sandboxes (iTunes Search
often returns 0 results). Treat an empty response as "try the next source",
not "no image exists".

**File conventions:** lowercase slugged names (`mr-robot.jpg`), covers ~600px
on the long side are plenty, JPG/PNG/WebP all fine.

**Rules:**
- Always end the image step with either art in place or an explicit one-line
  report of what was tried — never silently skip.
- Covers/posters alongside his commentary about that work: standard practice, fine.
- People photos: licensed sources only, credit recorded. Never grab a random
  Google Images result.
- Inline figures get a caption (`![[diia-app.jpg|The Diia app in 2020]]`) and,
  where the license requires, a credit line under the section using it.
- Never generate fake "covers" or AI portraits of real people.
- Creator portraits follow the People-photo rules exactly — licensed sources
  only, credit recorded, and a missing photo is reported rather than filled
  with a guess.

## Translation — ALL content, every time

The site has an English/Ukrainian toggle (flag switch in the sidebar). English
is primary, but **every piece of content ships in both languages** — title,
description, AND the full body. Translating only the title is not enough.

For every note you create or edit, produce two things:

**1. The title (frontmatter).**

```yaml
title: My Security+ journey
title_uk: Мій шлях до Security+
```

Add `title_uk:` to every note and section `main.md`. For section `main.md`
files also add `description_uk:` (the sidebar/section/home descriptions read it).

**2. The body (a sibling `.uk.md` file).**

- Post/entry `Foo.md` → translated body in `Foo.uk.md`.
- Section `main.md` → translated body in `main.uk.md`.
- The `.uk.md` file is **body only, no frontmatter**. The site shows it in
  Ukrainian mode and falls back to English if it's missing.
- Translate professionally and naturally — convey meaning and voice, never a
  literal word swap. Keep the SAME headings structure, callout types, wiki-link
  targets, image/diagram embeds, and `[progress:: n]` values; translate the
  prose, the callout titles, and the link *labels* (`[[Now/main|Зараз]]`).
- Diagram embeds stay identical (their `EN :: UK` caption + `.uk.svg` sibling
  already handle language — see Diagrams).
- `vault/Now/main.uk.md` is parsed, not rendered: keep the same headings in the
  same order and the same number of goals, rows and bullets as `main.md` —
  values pair up by position. Checkboxes, `#current` and `→` links come from
  the English file, so only the words need translating (see DECISIONS #26).

**Proper nouns:** use the established Ukrainian form when one exists (films/books:
official localized title — *Inception* → *Початок*; people: transliterate —
*Mykhailo Fedorov* → *Михайло Федоров*). Keep brand, product, and cert names
as-is when that's the real usage (*Security+*, *Starbucks*, *Obsidian*, *CompTIA*).

This is not optional and not "only when asked" — a note without its `.uk.md`
body is unfinished. Report both files in your summary.

## Diagrams

When a post or project would be clearer with a picture — a flow, an
architecture, a sequence, a comparison — offer a diagram (or make one when
asked). Full reference: `docs/EXCALIDRAW.md`.

**Default output: a self-theming SVG file.** Write it to the section folder and
embed it like an image:

```md
![[<note-slug>-<topic>.svg|A short caption]]
```

Rules for the SVG:

- Write the SVG markup directly: simple `<rect>`, `<path>`/`<line>`, and
  `<text>` elements. Use a marker for real directional arrows and a monospace
  secondary label for literal syntax when useful. Do not route the default
  workflow through a drawing tool or an Excalidraw export.
- Transparent background; no outer `<rect>` fill.
- Include an internal `<style>` with a `@media (prefers-color-scheme: dark)`
  block that recolors strokes/text for dark mode — so ONE file works on both
  themes (copy the pattern in `vault/Projects/attachments/publishing-pipeline.svg`).
- Neutral, legible palette: strokes/labels ~`#33373d` light / ~`#e6e8eb` dark,
  secondary text grey, thin arrows with a marker head. Rounded rectangles.
- Keep it simple and readable — a handful of labelled nodes, not a blueprint.
- Add `role="img"` and an `aria-label` describing the diagram.
- **Don't fuss over `font-family`.** A self-theming SVG is inlined into the
  page, and `globals.css` sets the typeface on `svg.diagram text` so labels
  match whatever the site is using. Any `font-family` written into the file is
  a presentation attribute and loses to that rule — harmless, but it isn't
  what's rendering. DO size labels so they render at roughly 13–14 CSS pixels
  at the narrowest supported viewport. SVG user units are scaled with the
  `viewBox`, so `font-size="14"` does not necessarily render as 14px on a phone.

This renders on the site immediately (no Obsidian export step) and adapts to the
reader's theme. Report the file path and where you embedded it.

**Always make it bilingual** (the site has a language toggle):

1. Write the English SVG (`<name>.svg`) and a Ukrainian twin (`<name>.uk.svg`)
   — same layout, translated labels. Translate prose labels; keep literal
   syntax tokens (`![[img]]`, `[progress:: 45]`) and technical names
   (`remark`, `rehype`) as-is.
2. Embed the English name only — `![[<name>.svg|English caption :: Український підпис]]`.
   The `::` splits the caption; the resolver finds the `.uk.svg` sibling itself.

Copy the pair `vault/Posts/attachments/rendering-pipeline.svg` / `.uk.svg` as a reference.

**If Kyrylo wants to hand-edit the diagram in Excalidraw:** say so — he can open
the SVG in the Excalidraw plugin, or draw his own and embed `![[Name.excalidraw]]`
(needs Auto-export SVG on; see EXCALIDRAW.md). Don't hand-author Excalidraw
scene JSON — it won't render on the site without the plugin's export.

## Image notes — photographed notes → clean diagrams

An **Image note** starts with a photograph of Kyrylo's handwritten page. Rebuild
its meaning as a clean graph, timeline, flow, map, or comparison while keeping
the photograph available as the primary-source view.

### Intake contract

1. **Make a transcription map before redesigning.** Record these six groups
   explicitly in the working report: exact readable text; dates/numbers; nodes;
   arrows/relationships; corrections or crossed-out content; and uncertain
   handwriting. The map is a review step, not another vault file. Resolve a
   genuine uncertainty with Kyrylo before drawing, or carry it into the diagram
   with a visible `?`/uncertain treatment and report it at handoff.
2. **Every displayed claim needs a source.** Correct obvious spelling (for
   example, “kindergarden” → “kindergarten”) and normalize date formatting, but
   do not add explanatory microcopy, inferred emotions, or connective claims.
   Structural phase labels may summarize only facts already present in the map.
   List every correction in the handoff report so it can be checked against the
   photograph.
3. **Preserve meaning, not notebook geometry.** Choose the clearest diagram
   structure for the information. Keep the author's chronology, relationships,
   emphasis, and wording; remove crossed-out text and accidental page clutter.
   Pick the form from the meaning: chronology → timeline, causes/steps → flow,
   hierarchy → tree, alternatives → comparison, connected ideas → concept map.
   Do not turn every page into the same left-to-right chain.
4. **Keep it structured and personal.** Use the site's restrained nodes,
   typography, and hierarchy, then preserve one or two meaningful visual cues
   from the source — for example its winding route, a rupture, circled choices,
   or a distinctive emphasis mark. Do not trace the notebook mechanically and
   do not force every source into the same panel template.
5. **Apply the normal diagram recipe.** After extracting the photo, write
   `<name>.svg` directly and make a `<name>.uk.svg` twin with identical geometry
   and professionally translated labels. Use the same hand-authored SVG rules,
   dark-mode style block, accessible label, and reference files from Diagrams
   above. Proper nouns follow the Translation rules. Excalidraw is not an
   intermediate or required source file.
6. **Keep the original safely.** Copy it into the target section's
   `attachments/`, strip EXIF/GPS/device metadata, bake in orientation, and
   resize to about 1600px on the long edge. Never publish the untouched phone
   original when it contains location metadata.
7. **Transparent and native-looking.** Use the self-theming SVG rules above:
   no canvas/background rectangle, monochrome page colors, the site's typeface,
   simple rounded nodes, and reduced visual noise.
8. **Rebuild the information architecture.** Group related facts into named
   phases, give dates/labels a consistent hierarchy, use arrows only for real
   relationships, and use secondary labels only when their text appears in the
   transcription map. The point is to make the note easier to scan, not to trace
   the handwriting neatly or editorialize it.
9. **Match the source canvas.** Give the SVG a `viewBox` within 2% of the
   same aspect ratio as the sanitized photo. The site reserves one shared frame
   from the photo's build-time dimensions, so both views remain centered and the
   article never jumps when the reader switches them.
10. **Run a legibility pass.** Check both languages at the actual prose width and
   at a phone width, in light and dark mode. Split or shorten labels that clip;
   never shrink all text to rescue one long translation. At 360px, primary
   labels should remain comparable to the surrounding body text and secondary
   text must remain comfortably readable without opening the lightbox.

### Build-time validation

Run `npm run validate:image-notes` after adding or changing an Image note. It is
also part of `predev` and `prebuild`, so an invalid pair cannot silently deploy.
The validator checks asset existence, a bilingual caption/export pair,
matching geometry, source-photo aspect ratio and privacy metadata, accessible
self-theming SVGs, live dark-mode styles,
transparent canvases, unsafe/external SVG content, and complete bilingual
light/dark exports when the note embeds an Excalidraw drawing directly.

The validator cannot decide whether a label is faithful to handwriting. The
transcription map, correction list, and visual review remain required even when
the command passes.

### Embed syntax

Put the source-photo directive **immediately after** the normal diagram embed:

```md
![[my-timeline.svg|My path so far :: Мій шлях дотепер]]
<!-- image-note: my-timeline-original.jpeg -->
```

Obsidian displays the diagram and hides the HTML comment. The site upgrades the
pair into one figure with a `Diagram / Original` (`Схема / Оригінал`) switch;
the diagram is the default. Both views still open in the existing lightbox.
The switch is native HTML and works without JavaScript. Both views occupy the
same dimensioned stage; switching changes only what is painted inside it, not
the height of the article.

The first embed may also be an exported drawing:

```md
![[my-timeline.excalidraw|My path so far :: Мій шлях дотепер]]
<!-- image-note: my-timeline-original.jpeg -->
```

Use this form only when Kyrylo explicitly wants an editable Excalidraw drawing.
Create and export it through the plugin; never hand-author Excalidraw scene
JSON. The default photo-note workflow remains the direct semantic SVG pair.

### Where files go

- Put the diagram pair and sanitized source photo beside the page's other loose
  media in that section's `attachments/` folder.
- Use lowercase slugged names: `<note-slug>-<topic>.svg`,
  `<note-slug>-<topic>.uk.svg`, and
  `<note-slug>-<topic>-original.jpeg`.
- Embed the pair in both language bodies with the exact same two lines. The
  `.uk.svg` sibling and bilingual caption handle the visible translation.
- If Kyrylo has not named the destination page, prepare and report the assets
  but do not attach them to an arbitrary note.
- In the final report, include the transcription map, spelling/date corrections,
  uncertainties and their resolution, plus the validator and visual-check
  results. Do not commit the map as a sidecar file.

## Sources section

Notes making factual claims (People, current-events posts) end with:

```md
## Sources

- [Article title — Publication](https://…)
- [Mykhailo Fedorov — Wikipedia](https://…)
```

2–4 links, the ones actually used to verify facts. Skip it for pure-opinion
posts, shelf thoughts, and music notes — don't pad.

## Wiki-link rules

- To another note: `[[Note file name]]` or `[[Note file name|shown text]]` —
  resolves site-wide by file name, title, slug, or alias (case-insensitive).
- To a SECTION page: always `[[Folder/main|Label]]` (e.g. `[[Now/main|Now]]`).
  Bare `[[Now]]` would create a stray note in Obsidian.
- Don't force links; 1–4 per note is typical.

**Aliases — give every new note its natural names.** Add an Obsidian-native
`aliases:` list to the frontmatter with the phrases people would actually
write: the subject itself, short forms, common spellings. Example: the post
"My Security+ journey" declares

```yaml
aliases:
  - CompTIA Security+
  - Security+
```

so `[[CompTIA Security+]]` anywhere on the site (or typed in Obsidian, which
autocompletes aliases) links straight to it. Think "what phrase will future
notes use when mentioning this?" — that's the alias list.

**Retro-linking — automatic, both directions.** After writing a new note:

1. Search the vault (grep titles + bodies) for existing text that mentions the
   new note's subject or aliases.
2. Where an existing note contains the exact phrase, convert THAT phrase into
   a wiki link (`CompTIA Security+` → `[[CompTIA Security+]]`, or
   `[[New Note|existing phrase]]`). Never reword sentences to force a link,
   never add new sentences to old notes, max one link per phrase per note.
3. List every retro-edit in the report ("linked 'CompTIA Security+' on Home →
   new post").

This is the expected behavior — new content should knit itself into the site
without being asked.

## Toolbox you may use in content

Callouts `> [!note|tip|warning|danger] Title`, tables, fenced code blocks,
`![[img.jpg]]` embeds (`|caption`, `|400` width, ≤128 = circular avatar),
auto-embedding Apple Music **and YouTube** links (a bare link alone on a line
becomes a player). The full demo lives at `vault/Posts/Examples/Formatting playground.md`.

**Code blocks** are syntax-highlighted at build time. Add a filename header
with ` ```bash title="scan.sh" ` (a bare ` ```bash scan.sh ` works too). The
language must be listed in `LANGS` in `lib/highlight.ts` — unknown ones fall
back to plain text rather than failing the build, so check that list before
using something exotic.

## Fact handling

Verify checkable facts (dates, names, titles) with web search when the note
makes factual claims — flag corrections to him rather than silently changing
his claims. Never fabricate facts, quotes, or sources to fill a template gap.

## What NOT to do

- Don't touch code, styling, or docs during content work.
- Don't reorganize or rename existing notes without being asked. (Exception:
  retro-linking edits — converting an existing exact phrase into a wiki link —
  are expected and always reported.)
- Don't add content he didn't provide (except structure, links, and the
  factual table rows he'd obviously want filled — flag anything you filled).
- Don't reproduce copyrighted text (book passages, lyrics) — his quotes are
  his responsibility; you never source them yourself.
