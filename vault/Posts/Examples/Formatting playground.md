---
title: Formatting playground
title_uk: Майданчик форматування
date: 2026-07-16
category: Meta
description: Every tool this site supports, demonstrated in one post.
description_uk: Усі інструменти, які підтримує сайт, показані в одному дописі.
maturity: evergreen
---

A living demo of everything you can use in a note. Steal from it freely, or delete it once you know the toolbox.

## Callouts

> [!note] A note callout
> Blue, for asides and context. Written as `> [!note] Title` in Obsidian.

> [!tip] A tip callout
> Green, for advice. Also answers to `[!success]`, `[!check]`, `[!done]`.

> [!warning] A warning callout
> Amber, for gotchas. Also `[!question]`, `[!caution]`.

> [!danger] A danger callout
> Red, for things that bite. Also `[!error]`, `[!bug]`, `[!failure]`.

## Wiki links

Link to any note anywhere in the vault by name: [[Sapiens]] goes to the Shelf, [[Mykhailo Fedorov]] to People, and section pages work with a label like [[Now/main|the Now page]]. The `Folder/main` form matters — it keeps the link working in Obsidian too.

## Tables

| Syntax | Result |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |

## Code blocks

```bash
# fenced code with a language tag
nmap -sV --top-ports 100 scanme.nmap.org
```

## Quotes and rules

> A regular blockquote still looks like this.

---

## Images

Paste an image in Obsidian and it just works:

- `![[photo.jpg]]` — full width, click to open the lightbox
- `![[photo.jpg|Caption text]]` — the text becomes a caption under the image
- `![[photo.jpg|400]]` — fixed width
- `![[me.jpg|90]]` — 128px or smaller becomes a circular avatar

## Music

An Apple Music link pasted alone on a line becomes a player:

https://music.apple.com/us/album/clancy/1733370881

## Diagrams

Two kinds, both fully static. Draw in Excalidraw and embed `![[Name.excalidraw]]`, or use a self-theming SVG like the one below — it recolours itself for light and dark mode. Here's the whole pipeline that renders this very post:

![[rendering-pipeline.svg|From an Obsidian note to a static page — every syntax on this page passes through here :: Від нотатки Obsidian до статичної сторінки — увесь синтаксис на цій сторінці проходить сюди]]

Full guide: see the Excalidraw docs in the repo. Ask the AI for a diagram and it drops one in.

## Drafts

Add `draft: true` to any note's frontmatter and it shows up locally with an amber badge but never gets published. There's one in this folder right now — you can only see it in `npm run dev`.

## Spoilers

Two ways to hide something until the reader asks for it. Inline, wrap it in
double pipes: the twist is that ||Elliot was the narrator all along||. In
Obsidian it stays plain text; on the site it's blurred until clicked.

For anything longer, use a spoiler callout — an ordinary callout in Obsidian,
click-to-reveal here:

> [!spoiler] How the film ends
> The top is still spinning when the screen cuts to black, and Nolan has
> refused to say whether it falls.

Neither needs JavaScript — they're a checkbox and a label underneath.

## Note maturity

Every post carries a growth stage, shown next to the reading time. Add
`maturity: seedling`, `budding` or `evergreen` to a note's frontmatter. Leave
it out and the note reads as a seedling — this post is marked `evergreen`.
