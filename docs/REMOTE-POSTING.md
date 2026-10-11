# Remote posting: `/post` and `/sync`

Two commands the owner types to an agent. `/post` turns a message into a
published note from anywhere, including a cloud session on his phone. `/sync`
brings whatever was published remotely onto the laptop, where Obsidian shows it.

The Claude Code command files are `.claude/commands/post.md` and
`.claude/commands/sync.md`; they only point here. An agent without slash
commands treats a message that starts with `/post` or `/sync` the same way.

## Where am I?

Both commands behave differently on the laptop and in the cloud, so settle this
first. It is a **cloud session** when `CLAUDE_CODE_REMOTE` is set, or the
checkout is anywhere other than the owner's laptop
(`/Users/kyryloleshchenko/…`). Otherwise it is the **laptop**.

## `/post <message>`

The message is the content plus whatever he says to do with it ("put this on
the shelf", "add this to Now", "make it a TIL"). Do what it says; the
instructions in the message win over the defaults.

1. Run the ordinary intake in `docs/CONTENT-WORKFLOW.md`, all of it: classify,
   light-touch edit, wiki links and `aliases:`, retro-links, images, `## Sources`
   for factual notes, `title_uk:` and the `.uk.md` sibling. `/post` changes how
   the note is published, never how it is written.
2. Questions are still batched and still only for real ambiguity. He is on a
   phone: a question costs him more there, so lean on the defaults harder.
3. **Never `draft: true` and never `_drafts/`** from a cloud session. That
   folder is ignored by Git, so a draft made in the cloud dies with the session.
   If he asks for a draft remotely, say so and ask whether to publish or wait.
4. Publish:
   - **Laptop.** Write into `vault/` and stop. Obsidian Git commits and pushes
     within 10 minutes; do not commit for him.
   - **Cloud.** `npm ci`, `npm run check`, `npm run build`. Push to a branch,
     open a PR, then **merge it** (`gh pr merge --squash --delete-branch`, or
     the session's GitHub tool). Merging is what publishes: Vercel deploys
     `main`. **Never commit or push to `main` directly**, for the reason in
     `docs/YOUTUBE-SHELF.md`: a direct push races Obsidian Git on the laptop,
     and a server-side merge does not. If the session cannot merge, leave the
     PR open and give him the link to tap Merge himself.
5. Images in the cloud: ask before downloading as always. If the session's
   network blocks an approved source, publish without the image and list it in
   the report as owed; do not substitute another source.
6. A cloud `/post` touches `vault/` only. No code, styling or docs in the same
   branch.
7. Report as the workflow says (path, future URL, links, images and sources,
   fixes, assumptions), plus the PR link and whether it was merged. In the
   cloud the PR body carries the same report, so `/sync` can read it back.

A check or build that fails is not merged. Say what failed and leave the PR
open.

## `/sync`

Laptop only. A cloud session cannot reach the laptop: say that and stop.

1. `git status --short`, then `git fetch origin`.
2. `git log --oneline HEAD..origin/main`. Nothing there means the laptop is
   already current: say so, and still do step 6.
3. Compare the incoming files (`git diff --name-only HEAD...origin/main`) with
   the uncommitted ones. **If a file is in both, stop** and list them; he
   decides. Never `git stash`, `git restore` or `git checkout --` his edits.
4. `git pull --no-rebase origin main`. Merge, not rebase: it is what Obsidian
   Git does (`syncMethod: merge`). Uncommitted edits to other files ride
   through untouched.
5. On a conflict, `git merge --abort` and report the files. Do not resolve
   vault content by guessing, and do not leave the tree mid-merge: Obsidian Git
   commits everything on a timer and would publish the conflict markers.
6. `gh pr list --state open`: a `/post` PR that never merged is a note that
   never published. List any, with links.
7. Do not push. Obsidian Git pushes on its next cycle.
8. Report what arrived: each new or changed note with its path and URL, taken
   from the pulled commits and their PR bodies. If `npm run dev` is running and
   new images came in, run `node scripts/sync-assets.mjs` so they show locally.

Obsidian reads the folder directly, so the notes are visible the moment the
pull finishes. Obsidian Git also pulls on its own when Obsidian starts
(`autoPullOnBoot`) and before each push; `/sync` is the on-demand version, with
a report.
