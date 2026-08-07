---
title: Dispatch
title_uk: Dispatch
date: 2026-08-06
description: A local-first planner for macOS and iPhone, built for exactly one user.
description_uk: Локальний планер для macOS та iPhone, зроблений рівно для одного користувача.
aliases:
  - Dispatch
  - TaskDispatch
---

Dispatch is a planner I'm building for myself — a native macOS and iPhone app that keeps my tasks on my own devices first and syncs them second. It's early: it runs, it's not finished, and it's already the most complicated thing I've written.

The rule I set at the start is that it never has to ask the network for permission. Every write lands in SwiftData locally and works offline; Supabase carries it to the other device afterwards, and realtime updates are a nudge to refresh rather than the thing recovery depends on.

The half I actually find interesting is letting an AI agent use it. Dispatch speaks MCP, but an agent never gets my account — it gets a scope that's explicit, short-lived, revocable, and narrower than my workspace, and every write it makes is checked against that scope and recorded.

A few decisions so far:

- **One write path.** Every model mutation goes through `WorkspaceStore`, so revision history, undo, widget snapshots and cloud sync can't drift apart.
- **Personal use only.** No paid Apple Developer membership, so it installs on my machines and nowhere else — no App Store review, no settings for other people's preferences.
- **Keys aren't permissions.** The publishable Supabase key is client-side and proves nothing; row-level security and the signed-in user's token are what actually protect the data.
- **Conflicts are loud.** Revision-sensitive writes carry the revision they expect, retries carry an idempotency key, and a conflict stops rather than overwrites.

Stack: Swift + SwiftUI, SwiftData, Supabase (Postgres, RLS, Realtime), an OAuth portal on Vercel, MCP for agent access. Xcode 27 beta. watchOS later, maybe.

I wrote up the thinking behind it in [[Building my own planner]].
