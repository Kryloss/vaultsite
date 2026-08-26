---
title: Building my own planner
title_uk: Як я будую власний планер
date: 2026-08-06
category: Cybersecurity
description: Why I'm building a planner nobody asked for, and the decisions underneath it.
description_uk: Чому я роблю планер, якого ніхто не просив, і які рішення за ним стоять.
draft: true
---

There are hundreds of planners and I'm building another one. It's called [[Dispatch]], it runs on my Mac and my phone, and right now it barely works — which is the honest reason to write about it while the decisions are still visible.

## Why build one at all

Partly because nothing quite fits. Every planner I've used is opinionated about how a day should be shaped, and I keep bending my week around the app instead of the other way round.

Mostly, though, because building it teaches more than using it. Swift, SwiftData, a real database with real access rules — this is a project with enough surface area to be wrong in interesting ways.

The useful constraint is that it's for one person. No paid Apple Developer membership, so it installs on my own machines and nowhere else. No App Store review, no onboarding flow, no settings screen for other people's preferences. Every decision only has to be right for me, and when it isn't I'm the only one who has to live with it.

## Local first, sync second

The core rule: a write never waits on the network. Typing a task saves to SwiftData on the device immediately, and syncing to Supabase happens afterwards, out of the way.

That sounds obvious until you build the alternative by accident. If the cloud is the source of truth, every airplane, elevator and dead Wi-Fi network becomes a bug report. So realtime updates are treated as a *hint to refresh*, not as the mechanism data recovery depends on — if the socket never fires, the app still catches up on its own.

![[dispatch-architecture.svg|How a change travels through Dispatch :: Як зміна проходить через Dispatch]]

## One door for every write

Every change to the data model goes through a single object, `WorkspaceStore`. Nothing writes to the database directly, not even the small stuff.

The reason is that a task edit isn't one thing happening. Revision history, undo state, the snapshot the widget reads, and the queue waiting to sync all have to agree about what just happened. Two write paths means two chances for them to disagree, and the disagreements surface days later as a widget showing a task you deleted.

The bill for sync arrives when you add a single field. One new property means updating the SwiftData model, the cloud data-transfer object, the encode and decode mapping, a Supabase migration, and the row-level security rule that governs it — five places, in one change, or the field half-exists. Nobody tells you sync costs that up front.

## The part I actually care about: letting an agent in

Dispatch exposes an MCP interface, so an AI agent can read and change my plan. That's the feature I'm most interested in and the one I'm most careful with, because "an assistant that can edit your tasks" and "a program with your account" are one sloppy design decision apart.

The rules I'm holding myself to:

- **An agent gets a scope, never my account.** Explicit, short-lived, revocable, and narrower than my full workspace whenever it can be. Handing over one project doesn't quietly widen into everything.
- **Every write validates that scope and gets logged.** If I can't tell afterwards which agent did what, the log isn't doing its job.
- **Writes carry the revision they expect.** If the record moved since the agent read it, the write fails as a conflict instead of flattening whatever happened in between.
- **Retries carry an idempotency key.** A network hiccup shouldn't quietly create the same task twice.
- **No permanent-delete tool.** Not until deletion is recoverable and I've explicitly turned it on.

> [!warning] A key in the client is not a lock
> The publishable Supabase key ships inside the app, so anyone with the app has it. It identifies the project; it authorises nothing. What actually protects the data is row-level security plus the signed-in user's token — the rules live in the database, where a client can't argue with them.

## What Security+ looks like when it's not on a flashcard

Reading the [[Security+|exam objectives]] and then writing this were oddly the same exercise. Least privilege stopped being a definition the moment I had to decide what a scope should *not* include. Non-repudiation is just the activity log. Fail-safe defaults is the conflict that stops instead of overwriting.

I don't think I understood any of those three until something I wrote could get them wrong.

## Where it is now

Early. The Mac and iPhone versions share almost all their interface, sync works often enough to be annoying when it doesn't, and the agent side is more design than code. watchOS is a someday.

I'll keep the [[Dispatch|project page]] updated as it gets less broken.
