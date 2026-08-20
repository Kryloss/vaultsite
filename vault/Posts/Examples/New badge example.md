---
title: New badge example
title_uk: Приклад значка «Нове»
date: 2026-08-20
category: Meta
description: Dated today, so it carries the New chip until you come back tomorrow.
description_uk: Датовано сьогоднішнім днем, тож несе значок «Нове», доки ти не завітаєш наступного разу.
draft: false
---

This note is dated **2026-08-20**, so a reader who was last here before today sees a small **New** chip beside its title in the posts list and on the home page.

To see it locally, open the console once and set the marker to a visit in the past:

```js
localStorage.setItem("notes-seen", JSON.stringify({ prev: null, last: new Date("2026-01-01T12:00:00").getTime() }));
location.reload();
```

Three rules decide the chip, all of them in `lib/new-notes.ts`:

- **Newer than the day of your last visit.** Not newer than a timestamp — an entry's `date` is day-granular, so a millisecond comparison flips across a timezone offset.
- **Not older than 30 days**, however long you have been away. See [[New badge, past the cap]] for what that looks like.
- **Never on a first-ever visit**, because there is no previous visit to be new since.

The marker moves once per *session*, not once per page load, so the chips survive a reload and a browse around. Clear the key to start over:

```js
localStorage.removeItem("notes-seen");
```

This note is `draft: true`, so it only exists in `npm run dev`. Delete the whole `Posts/Examples` set when you have seen enough.
