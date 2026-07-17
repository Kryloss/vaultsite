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
author: <author / director / creator>
medium: book | movie | show
date: YYYY-MM-DD
description: <one sentence>
# cover: <slug>.jpg   ← drop into vault/Shelf/ and uncomment
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
  resolves site-wide by file name, title, or slug (case-insensitive).
- To a SECTION page: always `[[Folder/main|Label]]` (e.g. `[[Now/main|Now]]`).
  Bare `[[Now]]` would create a stray note in Obsidian.
- Actively add links where the new content mentions an existing note
  (people, shelf items, other posts) — and mention (don't edit unasked) older
  notes that could now link back to the new one.
- Don't force links; 1–4 per note is typical.

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
- Don't reorganize or rename existing notes without being asked.
- Don't add content he didn't provide (except structure, links, and the
  factual table rows he'd obviously want filled — flag anything you filled).
- Don't reproduce copyrighted text (book passages, lyrics) — his quotes are
  his responsibility; you never source them yourself.
