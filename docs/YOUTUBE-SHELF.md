# YouTube → Shelf

How a video Kyrylo saved on YouTube becomes a shelf note. Run nightly by a
scheduled cloud task; runnable by hand at any time.

## The queue is a playlist

Watch history is closed — Google removed it from the YouTube Data API in 2016,
and only Google Takeout still exports it, by hand. So the input is a **public
playlist**, `Shelf`:

    https://www.youtube.com/playlist?list=PLUHvkEsS44tE

Saving a video to it is two taps in the YouTube app. That is a better signal
than raw history anyway: history is full of things you clicked and abandoned,
and the shelf is a judgment.

**The playlist is the whole queue.** Nothing records a decision anywhere: a
video that is in the playlist and has no note is pending, every single run. To
drop one for good, remove it from the playlist — the same gesture that put it
there. Deleting a note without touching the playlist means the note comes back
tomorrow, which is the honest reading of "it is still on my shelf playlist".

## Keyless, like the rest of the shelf

Three endpoints, no API key, no OAuth, no Google Cloud project:

| Endpoint | Gives |
|---|---|
| `feeds/videos.xml?playlist_id=…` | video id, title, channel, **publish date**, description |
| `oembed?url=…` | title, channel name, `author_url`, thumbnail |
| channel page `og:image` | the channel's square avatar |

Same footing as the iTunes lookup behind music covers and the oEmbed call in
the creator-photo cascade (`docs/CONTENT-WORKFLOW.md` → Images & media
sourcing).

## The split: script does facts, agent does judgment

`scripts/youtube-shelf.mjs` is **deterministic only** — fetch, parse, diff,
download. It writes no notes, on purpose: a shelf note needs a translated
title, descriptions in two languages, categories and a creator bio, and that is
judgment, not string formatting.

```bash
node scripts/youtube-shelf.mjs pending            # JSON: playlist videos with no note
node scripts/youtube-shelf.mjs avatar <channel-url> <creator name>
node scripts/youtube-shelf.mjs uploaded <video-id>  # a video's own publish date
```

`pending` diffs against the `video:` frontmatter key across the whole vault. A
YouTube link in a post's body is an illustration, not a shelf entry, so it does
not count.

The `avatar` command refuses a name with no Latin letters rather than writing a
file called `.jpg`. A Cyrillic channel needs a transliterated name — the folder's
`andrey-doronichev.jpg` is the precedent — passed in explicitly.

Covered by `scripts/youtube-shelf.test.mjs`, which also pins the mirrored
video-ID regex against `lib/youtube.ts` the way `validate-image-notes.test.mjs`
pins `MAX_INLINE_SVG`.

## The run

1. `node scripts/youtube-shelf.mjs pending`. Empty output → stop, say nothing.
2. For each pending video:
   - **Title.** Write a natural English title and `title_uk:`. The feed's title
     is often clickbait, in a third language, or both — the note's title is the
     note's, not the upload's. Keep the original in `## Sources`.
   - **Creator.** `author:` names the **channel**, never its host — that is why
     the portrait is the channel's avatar. `node … avatar <channelUrl> <name>`
     writes a 320px square into `vault/Shelf/creators/`. Add the provenance
     comment line that every other note carries.
   - **Bio.** Two or three lines on the channel, in both languages. Verify it
     against a real source; do not write it from memory.
   - **`uploaded:`** ← the feed's publish date. This is the field the site can
     otherwise never know, and the one that upgrades the note's JSON-LD from
     `CreativeWork` to `VideoObject` (DECISIONS #41).
   - **`date:`** ← today. That is when it was shelved, which is a different
     fact and must not be confused with `uploaded:`.
   - **`description:` / `description_uk:`** ← one sentence. The feed's
     description is mostly sponsor copy and timestamps; condense the two useful
     lines out of it, never paste it.
   - **`categories:`** ← from the vocabulary already in the vault (Tech,
     Education, Politics, Nonfiction, …). Do not invent a new one for a single
     video.
   - **Fact table.** The headerless `| | |` shape, `## At a glance` heading kept
     in the markdown (#87). Useful rows only. `Language` earns its place when
     the video is not in English.
   - **Wiki links.** Check whether the vault already knows the people or
     subjects involved and link them — `aliases:` are matched vault-wide. This
     is expected, not optional.
   - **`.uk.md` sibling**, body-only, same structure and links.
3. **Leave `## Why it's on the shelf` empty**, with the comment the existing
   notes carry. Never invent an opinion; that section is Kyrylo's.
4. `npm test`, then `npm run build`.
5. Push to a branch and open a PR — **never commit to `main`**. Obsidian Git
   auto-commits and pushes this repo every 10 minutes, and a cloud push racing
   it leaves the owner a conflict on his laptop.
6. Report: video, note path, future URL, image fetched and its source, links
   added, and anything assumed.

## Notes on judgment

- **A note is not an endorsement**, and the shelf carries political material.
  State what a video is and who made it, verified; leave the verdict to the
  empty section.
- A video whose subject the vault has no business publishing is a **question,
  not a commit**. Open the PR with the note omitted and say why.
