---
title: New badge in people
title_uk: «Нове» в розділі «Люди»
date: 2026-08-20
category: Meta
description: A people card, dated today, with no chip on it.
description_uk: Картка людини, датована сьогодні, без значка.
draft: true
---

Same date as the two examples in Posts, same absence of a chip.

People renders as a cover grid (`components/lists/PeopleCards.tsx`), where a card is a photo and a name. If the chip goes anywhere here it is a mark on the card itself, not a chip after a title — which is the same problem the shelf has, and the reason both were left out of the first version.

Ask and it can be extended: `components/NewBadge.tsx` takes a `date` and nothing else, so any list that has one can mount it.
