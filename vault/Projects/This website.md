---
title: This website
date: 2026-07-17
description: A portfolio published straight from an Obsidian vault.
---

The site you're reading is itself the first project. It's a Next.js site where my Obsidian vault **is** the CMS: create a folder with a `main.md` and it becomes a page in the sidebar; drop a note into that folder and it becomes a post with its own URL. Hitting save in Obsidian auto-commits to GitHub, Vercel rebuilds, and the change is live in about a minute.

![[publishing-pipeline.svg|How a note becomes a page :: Як нотатка стає сторінкою]]

A few decisions I'm happy with:

- **No database.** Content is markdown in git — versioned, portable, free.
- **Fully static.** Every page is pre-rendered at build time, so it's fast and there's nothing to hack at runtime. Fitting, for a future security person.
- **Pluggable page styles.** Each section declares a `type` (posts, music, people, projects) and the code maps it to a layout — this page is the `projects` type.
- **Obsidian syntax works.** Wiki links, image embeds with widths, even Apple Music links that turn into players.

Stack: Next.js 15, Tailwind CSS v4, Obsidian + Git plugin, GitHub, Vercel. Design heavily inspired by [brianlovin.com](https://brianlovin.com).
