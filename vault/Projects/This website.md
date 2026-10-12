---
title: This website
title_uk: Цей сайт
date: 2026-07-17
description: A portfolio published straight from an Obsidian vault.
description_uk: Портфоліо, що публікується напряму зі сховища Obsidian.
---
The site you're reading is itself the first project. It's a Next.js site where my Obsidian vault **is** the CMS: create a folder with a `main.md` and it becomes a page in the sidebar; drop a note into that folder and it becomes a post with its own URL. Hitting save in Obsidian auto-commits to GitHub, Vercel rebuilds, and the change is live in about a minute.

![[publishing-pipeline.svg|How a note becomes a page :: Як нотатка стає сторінкою]]

A few decisions I'm happy with:

- **No database.** Content is markdown in git: versioned, portable, free.
- **Fully static.** Every page is pre-rendered at build time, so it's fast and there's nothing to hack at runtime. Fitting, for a future security person.
- **Pluggable page styles.** Each section declares a `type` (posts, music, people, projects) and the code maps it to a layout; this page is the `projects` type.
- **Obsidian syntax works.** Wiki links, image embeds with widths, even Apple Music links that turn into players.

Stack: Next.js 15, Tailwind CSS v4, Obsidian + Git plugin, GitHub, Vercel. Design heavily inspired by [brianlovin.com](https://brianlovin.com).

## Updates

  

> [!update] 2026-10-06 Code: The repository got a front door
> A README with screenshots, an MIT licence, and a CI check that runs the type check and the tests on every push.

> [!update] 2026-09-25 Design: One material for everything that floats
> The sidebar, the contents sheet, the series list and the link previews now share the breadcrumb bar's blurred surface and hairline. The sidebar itself floats off the edge of the window.

> [!update] 2026-09-24 Feature: Read aloud
> Every note has a Listen button. The player has a seek bar and follows the language switch.

> [!update] 2026-09-14 Content: Reels and TikToks on the shelf
> Instagram reels and TikTok videos can sit on the [[Shelf/main|shelf]] next to books, films and YouTube.

> [!update] 2026-08-20 Feature: A "New" chip
> Notes dated since your last visit carry a small New chip, so coming back shows what changed.

> [!update] 2026-07-16 Launch: First commit
> The vault became a website.
