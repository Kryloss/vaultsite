---
title: New badge example
title_uk: Приклад значка «Нове»
date: 2026-08-20
category: Meta
description: Dated today, so it carries the New chip for anyone who was here before it went up.
description_uk: Датовано сьогодні, тож несе значок «Нове» для кожного, хто був тут до його появи.
---

This note is dated **2026-08-20**, so a reader whose last visit ended before it went up sees a small **New** chip beside its title — in the posts list and on the home page.

To see it now, open the console once and put your last visit an hour into the past:

```js
localStorage.setItem("notes-seen", JSON.stringify({ prevAt: null, last: Date.now() - 60 * 60 * 1000 }));
location.reload();
```

Four rules decide the chip, all of them in `lib/new-notes.ts`:

- **It arrived after your last visit.** A note dated D counts as arriving at the *end* of D, compared against the timestamp of your previous visit — so something published this afternoon is new to you this evening, even though you were already here this morning.
- **Not older than 30 days**, however long you have been away. See [[New badge, past the cap]] for what that looks like.
- **Never on a first-ever visit**, because there is no previous visit to be new since. Every reader spends exactly one visit in that state.
- **The marker moves once per session**, not once per page load, so the chips survive a reload and a browse around.

Clear the key to start over:

```js
localStorage.removeItem("notes-seen");
```

This one is published, unlike the rest of `Posts/Examples` — delete it when you have seen enough.
