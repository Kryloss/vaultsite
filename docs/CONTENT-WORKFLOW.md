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
   movies, shows), People (profiles), Projects (things he built), Music
   (album/track thoughts), Now (rare — current-status updates edit
   `Now/main.md` in place).
2. **Clarify** → only if rule 2 triggers. Batch all questions at once.
3. **Structure** → apply the matching template below.
4. **Cross-link** → scan the new text AND existing notes for link
   opportunities (see wiki rules). This is a big part of your value.
5. **Source images** → covers for Shelf/People items, inline figures where
   they help (see "Images & media sourcing" below). Don't skip this step.
6. **Write the file** → `vault/<Section>/<Natural Title>.md`. File name = the
   title in normal words (spaces fine, no slashes/colons); the engine slugs it.
7. **Report** → tell him the file path, the URL it will get, links added,
   images fetched (with their sources), and anything you fixed or assumed.

## Defaults

- `date:` today (his timezone; YYYY-MM-DD).
- `category:` reuse an existing one when it fits (check other posts' frontmatter);
  ask before inventing a new one.
- `description:` write one — a single sentence in his voice, no marketing tone.
- `cover:`/images: if he mentions an image he'll add later, include the
  commented line: `# cover: name.jpg   ← drop into vault/<Section>/ and uncomment`.
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

### Shelf item — `vault/Shelf/<Title>.md`
```md
---
title: <Title>
author: <author / director / creator / channel>
medium: book | movie | show | video
categories: [<one or more — see the vocabularies below>]
rating: <0–5, halves allowed — ONLY if he gave one; never invent his rating>
date: YYYY-MM-DD
description: <one sentence>
cover: <slug>.jpg          # videos: omit — the thumbnail comes from `video:`
video: <youtube url>       # medium: video only
---
## At a glance
| | |
|---|---|
| Author | … |
| Published | … |
| One-liner | … |

## Why it's on the shelf
<his thoughts>

## Quotes
<his quotes as blockquotes — NEVER add quotes from the work yourself; if he
provides none, omit this section or leave a placeholder he can fill>
```

#**Shelf categories.** `categories:` is multi-valued — an item shows under each
one. They drive the filter chips on `/shelf/type/<medium>` and render as
`#tags` under the entry title; the shelf section page shows neither. Reuse an
existing name where it fits (grep other entries) rather than inventing a
near-duplicate — "Sci-Fi" and "Science Fiction" would become two chips.
Starting vocabularies per medium:

| Medium | Categories |
|---|---|
| video | Entertainment, Politics, Tech, Education, Music, PopSci |
| movie | Sci-Fi, Thriller, Drama, Action, Comedy, Documentary |
| show | Drama, Thriller, Comedy, Sci-Fi, Documentary, Anime |
| book | Nonfiction, Fiction, History, Science, Tech, Biography |

Genre classification is factual, so assign these yourself — unlike `rating:`,
which is his and never invented.

### Person — `vault/People/<Full Name>.md`
```md
---
title: <Full Name>
date: YYYY-MM-DD
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

## Images & media sourcing

Fetch images automatically — Kyrylo shouldn't have to hunt for covers.

**Preferred: download into the vault.** Save the file next to the note
(`vault/Shelf/sapiens.jpg`), set `cover: sapiens.jpg`. Vault files show up in
Obsidian, sync through git, and never rot. Ask permission before downloading,
batched in one line ("Downloading 2 covers: sapiens.jpg from Open Library
(~60 KB), fedorov.jpg from Wikimedia Commons (~120 KB) — OK?").

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
| Music artwork | Not needed — Apple Music embeds carry their own art |
| Inline figures | Wikimedia Commons, official docs/press kits, his own screenshots |

**Wide art (logos, banners):** set `coverFit: contain` in the entry frontmatter
— the card letterboxes it on the tile background instead of cropping. This is
how a freely-licensed title logo becomes a perfectly good cover when no poster
is available (see `vault/Shelf/Mr Robot.md`).

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

- Transparent background; no outer `<rect>` fill.
- Include an internal `<style>` with a `@media (prefers-color-scheme: dark)`
  block that recolors strokes/text for dark mode — so ONE file works on both
  themes (copy the pattern in `vault/Projects/publishing-pipeline.svg`).
- Neutral, legible palette: strokes/labels ~`#33373d` light / ~`#e6e8eb` dark,
  secondary text grey, thin arrows with a marker head. Rounded rectangles.
- Keep it simple and readable — a handful of labelled nodes, not a blueprint.
- Add `role="img"` and an `aria-label` describing the diagram.

This renders on the site immediately (no Obsidian export step) and adapts to the
reader's theme. Report the file path and where you embedded it.

**Always make it bilingual** (the site has a language toggle):

1. Write the English SVG (`<name>.svg`) and a Ukrainian twin (`<name>.uk.svg`)
   — same layout, translated labels. Translate prose labels; keep literal
   syntax tokens (`![[img]]`, `[progress:: 45]`) and technical names
   (`remark`, `rehype`) as-is.
2. Embed the English name only — `![[<name>.svg|English caption :: Український підпис]]`.
   The `::` splits the caption; the resolver finds the `.uk.svg` sibling itself.

Copy the pair `vault/Posts/rendering-pipeline.svg` / `.uk.svg` as a reference.

**If Kyrylo wants to hand-edit the diagram in Excalidraw:** say so — he can open
the SVG in the Excalidraw plugin, or draw his own and embed `![[Name.excalidraw]]`
(needs Auto-export SVG on; see EXCALIDRAW.md). Don't hand-author Excalidraw
scene JSON — it won't render on the site without the plugin's export.

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
auto-embedding Apple Music links. The full demo lives at
`vault/Posts/Formatting playground.md`.

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
