---
title: Formatting playground
date: 2026-07-16
category: Meta
description: Every tool this site supports, demonstrated in one post.
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

## Drafts

Add `draft: true` to any note's frontmatter and it shows up locally with an amber badge but never gets published. There's one in this folder right now — you can only see it in `npm run dev`.
