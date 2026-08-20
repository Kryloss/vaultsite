---
title: New badge on the shelf
title_uk: «Нове» на полиці
author: Example entry
medium: book
categories: [Meta]
date: 2026-08-20
description: Dated today — and still no chip, because the shelf doesn't render one.
description_uk: Датовано сьогодні — і значка немає, бо полиця його не показує.
draft: true
---

Dated today, exactly like [[New badge example]], and on a shelf row it shows nothing.

The chip currently lives in two places only: the posts list (`components/lists/PostRows.tsx`) and home's recent-posts list (`app/page.tsx`). Every other section type — shelf, people, projects, music — renders its own list component and knows nothing about it.

That is a scope decision, not an oversight, and the shelf is the one where extending it is least obvious: a card is artwork, not a row of text, so a chip would have to sit *on* the cover next to the "Reading" badge rather than after a title.
