# Music

Section type `music`: `vault/Music/`, covers in `vault/Music/covers/`. Code: `lib/music.ts` (grouping, reads `fs`), `lib/music-filter.ts` (pure, client-safe), `lib/music-facts.ts`, `lib/coverflow.ts`, `components/Coverflow.tsx`, `components/lists/MusicNotes.tsx`, `lib/apple-music.ts`. Note templates, `lang:`, `genres:`, the `artists:` list: `docs/CONTENT-WORKFLOW.md → Music note`. Reasons: DECISIONS #6, #10, #90–#105, #117, #123.

## Frontmatter

`artist:` (+ `artist_uk`, `artist_photo`, `artist_bio`, `artist_bio_uk`) — the key selects the Artist role in `entryCreator()`. `cover:` from the keyless iTunes Search API (`artworkUrl100` → `600x600bb`). `format:` (`album|track|single|ep|mixtape|live|compilation`) is inferred — a track id means Track, else Album — so write it only for an EP or single. `lang:` is the SHELF a record belongs on (`en`/`uk`/`ru` or a list), a decision, not the language sung: Нервы are `uk`, BLIND8 are `en`; never "fix" it from the lyrics; no `lang:` means reachable through All only. `genres:` is Apple's `primaryGenreName` split on the slash; search terms, never rendered. `rating:` optional, never invented. `description_uk:` is read into `Entry.descriptionUk`.

**Two biographies on purpose**: `artists:` in the section's `main.md` (`name`, `name_uk`, `photo`, `bio`, `bio_uk`, optional `tags`) describes the ARTIST and drives the deck header; a note's `artist_bio:` describes THAT RECORD and drives the note page. Artists live in frontmatter because any `.md` under the folder becomes a page.

## The section page is a cover deck

`Coverflow.tsx` rakes the notes' covers in 3D around a centred card. Constraints:

- **Grouped by artist**: `groupByArtist()` orders (newest artist first), `flattenGroups()` unrolls. Never re-sort by date.
- **Artist above, record below.** Header: name and full bio (the portrait is in the toolbar); caption: title `· Format`, description, up to three fact rows lifted from the note's own markdown (`lib/music-facts.ts` — the first headerless table, EN/UK merged by position, English throughout if the row counts differ; `date:` is the note's date, never a "Released" row). `genres:` is never a row. A note with no artist keeps an empty header slot; an unknown artist keeps the header without portrait or bio. The artist's name and portrait link to a People note when one exists (matched like `getWikiIndex()`), the bio never links, and nothing appears without one — tested in `lib/music.test.ts`, as is `format:` inference.
- **Cards are real links** and lay out as a wrapped grid until `data-ready`, so no-JS and crawlers see every cover. The recession is `--cf-fade` on the ARTWORK over an opaque `--bg` ground; element `opacity` is only the teleport fade. Artwork is `position: absolute; inset: 0`; the fallback card is `position: relative`.
- **Pressing an off-centre cover centres it.** The decision is made on `pointerup` in the frame from `data-cf-index` in the DOM; the card's `onClick` is a gate (`event.detail === 0` = keyboard, always opens). Rules: focus centres only on `:focus-visible`; `endDrag` does nothing for a press that never moved; the centre is `centredRef`, never `selected` or `targetRef`; nothing happens under `DRAG_SLOP` (10px) and crossing it rebases; `TAP_TRAVEL` (a fifth of a card of deck travel) decides tap vs drag; pointer capture starts only past the slop. A card faded past 6% is `pointer-events: none` and `tabIndex -1`.
- **`.cf-stage { pointer-events: none }`, `.cf-card { pointer-events: auto }`, `user-select: none` on `.cf-frame`** — under `preserve-3d` the stage's own plane swallowed presses on receded cards, and a press on the frame's padding anchored a text selection. Keep all three.
- **WebKit does not hit-test the raked cards**, so `cardAtPoint()` in `lib/coverflow.ts` measures the boxes first and `closest()` is only the seam fallback; `markHover()` writes an inline cursor on the frame for the same reason. Verify anything touching hit-testing in WebKit, not only Chromium.
- **`cursor: pointer` on the card is the whole affordance.** The hover veil (`.cf-card::after`, `data-cf-hover`) was removed at the owner's request; don't restore it, don't remove the cursor. `cursor: grab` is off the frame. A response, if ever, is a veil, never a transform (`paint()` owns `transform`) and never `.press`.
- **No pagination dots** (owner's request). Arrow keys drive the deck; `j`/`k` do not.
- **Nothing on the page may change height**: `.artist-bio-slot` is one grid cell holding the live bio plus hidden text copies of every other bio; description two lines; `MAX_FACTS` = 3 with a matching `.cf-facts` reservation; fact values one line with the full string in `title`; dots never wrap; `.cf-caption` carries the sum as its own floor. Floors are derived in `--cf-header-h`/`--cf-caption-h` — re-derive, don't nudge. Only a <480px window reserves a second title line.
- **Covers may pass `--measure`** (`--cf-width: min(72rem, 100vw - var(--gutter) * 2)`, centred by a negative margin); the artist block is prose and stays in the 36rem column. No wash on the section page.
- **Toolbar**: a three-column grid (`minmax(0,1fr) auto minmax(0,1fr)`) at every width with the portrait in the middle; every item names its `grid-row`. Above 640px the cheeks hold the heading and the search + language button (search 10rem); below, the heading is screen-reader-only (not `display: none` — the outline and Cmd+K read it) and each cheek holds one pill at `width: 5.5rem` (why `ui.musicSearch` is one word; the sentence is on the `aria-label`). The portrait is rendered twice and shown once (`display: none` on the other, never fetched); the toolbar copy is `aria-hidden` and not a link, with its own width. `Coverflow` takes `onSelect` (held in a ref). The one-line heading rule is a 639px query because the field's intrinsic width wrapped it; the field's SIZING (flex, floor, ceiling, the phone `width`) lives on the `.music-search-field` wrapper and the input just fills it at `width: 100%` with `min-width: 0`. `.cf-frame` keeps 0.5rem top padding on phones.

## Filter

A search field and ONE language button cycling `All → ENG → UA → RU → All` (`min-width: 3.5rem`, same material as the field), on the heading's line at every width (`.music-toolbar` is `nowrap`). RU paints its label in the flag's tokens — the one permitted second use; see `docs/DESIGN-SYSTEM.md`. Search: word-prefix over folded text (`fold()`), then a labelled trigram pass (`similarity()`) over title/artist/genre only; the artist's name and genres are folded into every note. Language and genre are never fuzzy. Local state, not URL params. The list half is a client component; the shapes and `filterGroups()` live in `lib/music-filter.ts`, which must never import `fs`.

**The field's label is not a `placeholder`** (#170). `.music-search-ghost` is a `<T>` pair of `<span>`s painted over the input, one span per letter (`GhostLabel`/`GhostLetters`), each carrying its index as `--i`; CSS turns that into a 45ms-per-letter `animation-delay` on the way OUT, so the label comes apart in reading order; coming back it is unused.

**It rises out a letter at a time and falls back as a whole word** (owner's call — leaving is a word coming apart, arriving is a word arriving). Two one-way keyframes: `music-letter-rise-away` lifts a letter out through the top (`translateY(-140%)`, `--dur`, faded by 60% of its own run, `animation-delay: calc(var(--i) * 45ms)`), `music-letter-fall-in` drops the label back from up there (`from: translateY(-140%)`, `--dur`, opaque by 30% so the fall is seen, `animation-delay: 0s` stated outright). The asymmetry is why this cannot be one transition: a transition's timing belongs to the property, not the direction, so a staggered exit is a staggered return however it is written. The rise ends where the fall begins, so the handover costs nothing. Animation properties are written as LONGHANDS — a shorthand carrying `var()` makes every longhand it covers a pending-substitution value, `animation-delay` among them, and the stagger must not depend on winning that fight.

Focus is `:focus-within`, a query typed and left behind is `data-filled`, and `data-touched` (set on first focus, never unset) is the one thing React contributes: without it the "empty again" selector also matches on first paint and the label falls into an untouched field on page load. The wrapper's `overflow: hidden` is the frame the letters fall behind. The input carries NO `placeholder` — two labels would print on top of each other — and the ghost is `aria-hidden`, the field's name coming from its `aria-label` as before. Under `prefers-reduced-motion` the label still clears the field and still comes back, without travelling or queueing; the hidden state is restated there as plain `opacity: 0`, since with no animation there is no forwards fill to hold the letters out of a typed query.

## A music note

Opens like a shelf note: artist block, plain fact list with `rating:` as the last row (`docs/SHELF.md → Entry page`), square OG card (`coverShape: "square"`), `MusicAlbum` JSON-LD wrapped in a `Review` when rated. The note tints its opening with its own cover (`.note-wash`): a wash anchored to `main` via `:has()` (window-wide, no `100vw`), artwork bled past the box by `--wash-bleed` (180px, more than the blur radius) with `max-width: none`, the mask on the box, `@keyframes wash-in` naming only `from` — never add `to:`.

## Players

- Standalone Apple Music links become players; `?i=` (song) gets the compact one, else the 450px album. Every URL carries `theme=auto`. Iframes are `loading="lazy"` (a hidden lazy iframe never loads — this is what makes hiding one free), no `sandbox`, `credentialless=""`.
- **Album player** on a music note moves to the right gutter from **1400px** (`.music-note`, `data-kind="album"`, `top: 5rem`, 20rem, `transform: scale(0.6667)` from `top left`); `--gutter-player-h` is the PAINTED height (265px). **Its height is not a knob** — Apple puts Play last and clips instead of reflowing. A song player never moves. 1400 stays: the layout box is 320px even when it paints at 213. The page sets `overscroll-behavior-y: none`, scoped, because elastic overscroll bounces fixed layers.
- **Track player**: full width, **150px** — measured floor (130 loses the disclosure line, 110 halves Play). Don't narrow or scale it.
- **Cropping Apple's chrome**: `--am-crop-top` 24px song / 34px album, `--am-crop-bottom` 16px song / 18px album, negative margins under `overflow: hidden` on `.am-crop`/`.apple-music-block` at all three mounts. The bottom values are the top of `a.legal-link` measured in Apple's DOM with Play pressed; "View in Apple Music" shares its band with the transport controls and cannot be cropped. Press Play before changing a crop value. Set both to 0 to restore the untouched player.
- No footer link of ours under embeds (`ui.openInAppleMusic` is parked); no wrapper card around the playlist; artwork inside a player cannot be hidden.
- Below 640px the album embed is hidden and a 2.25rem pill wearing the album cover in the top-right opens a frameless sheet with the full player (`components/MusicSheet.tsx`); `.page:has(.toc-bar)` steps it left.

## Today’s vibe — global capsule

The Home frontmatter holds `vibe_title`, `vibe_artist`, `vibe_date` (quoted
`YYYY-MM-DD` in America/Toronto), and `vibe_youtube`. The last takes any YouTube
link — `watch?v=`, `youtu.be`, Shorts, `/live/` — or the bare 11-character video
ID. Anything else, a playlist URL included, leaves the real pick visible with
“Audio coming soon”; it never substitutes a preview or pretends to play. The
former `vibe_audio` MP3 field and the Apple Music `vibe_url` / `vibe_artwork`
before it are no longer used (#164, #163).
Proper names stay original in both languages; shared metadata needs no new
Ukrainian prose or public music note.

The root layout validates the metadata and passes it to `Chrome`; nothing reads
the vault at runtime. The capsule is a 40px pill beside the breadcrumb chip,
wearing that chip's own `.chrome-bar` material — fill, hairline ring and blur —
at its height (#165). It is monochrome: playing is marked by the title coming up
to `--text`, not by colour. #163's marigold is gone, and with it the site's last
palette exception.

At rest the capsule shows only **the track's cover**, a 24px rounded crop of the
video's `mqdefault` thumbnail (`youtubeCover` — hqdefault has black bars baked
in and cannot be square-cropped). Hover or keyboard focus reveals the
play/pause mark over its scrim, the full title, seek line, and close button.
The title opens with `max-width` so the cover stays under the pointer. The close
button animates `flex-basis`, not `width` — the shorthand sets a basis and in a
flex row the basis is what decides the box, so animating width alone leaves an
invisible hole on the end of the pill. It is behind `(hover: hover)`, which now
only ever matches, since phones don't get the capsule at all.

The seek runs along the pill's lower edge, inset past the corner radius, in a
band the content leaves free — the trigger is 24px inside a 40px pill for
exactly that reason. Centred content and a centred seek shared a line once and
the track ran through the title's descenders. The played part is painted from a
`--vibe-progress` custom property set per render, because a range input has no
progress of its own.

Note the cover is fetched from `i.ytimg.com` on every page view, so the "nothing
of YouTube's until you press play" rule below now covers the player and its
script, not the thumbnail.

`TodaysVibe` plays a `youtube-nocookie` frame with YouTube's own interface
switched off — `controls=0`, `disablekb=1`, `fs=0`, `rel=0`, `iv_load_policy=3`,
`playsinline=1` — and the capsule is the only control. **The frame is parked
off-view with `opacity: 0` and `clip-path`, never `display: none` and never
sized to nothing: a frame hidden either of those ways has its playback
suspended.** It is `inert` and `tabIndex={-1}`, so it stays out of the tab order
and the accessibility tree.

**The player and API script load only on the first press** (the cover loads
earlier). The iframe requests autoplay, subject to the browser's sound policy.
API commands wait for readiness; see Playback recovery below. Afterwards play,
pause and seek go through the IFrame API; the position is polled every 500ms
while playing, because that API has no time event of its own.

### Not on phones (#167)

**Below 640px `.vibe` is `display: none` and the feature simply isn't there.**
The reason is worth keeping, because it looks like a bug otherwise: iOS starts
audio for a tap on the player itself and for nothing else — not `playVideo()`,
not `autoplay` in a frame built inside a tap elsewhere — so a hidden player on
an iPhone is a silent one, reporting only the watchdog's “Couldn't play”. The
fix would have to be a visible, tappable player, and #166 built one: a 16:9
panel under the chrome bar. The owner didn't want the screen it took. **So don't
re-add a phone capsule without a visible player** — a capsule alone cannot make
sound on an iPhone, and it will look broken rather than absent.

The breadcrumb chip's phone `max-width: calc(100vw - 12rem)` went with it; it
existed only to reserve room for the capsule.

A seek slider appears on desktop once duration is known. Keyboard arrows can
seek. Loading motion respects reduced motion. The player survives internal
navigation. Hiding pauses it and stores the choice, and a note takes over
**inside the breadcrumb chip, between the menu button and the crumbs** (#167) —
not as a chip of its own beside them: with no capsule to be, it is a control of
that bar. It is therefore a separate export mounted by `Chrome.tsx`, wearing the
menu button's classes rather than the capsule's, and it hands focus back to the
capsule over a `vibeopen` event because the two live in different trees. Missing
storage still remembers the choice during the visit. Stored state renders after
hydration, initially hidden.

Toronto date is checked every minute and on visibility changes; an older pick
reads “Latest vibe”. A missed morning does not change the selection date.

### Daily update workflow

A Codex heartbeat asks for a track at 07:00 America/Toronto in the owner's task.
After the answer, verify the exact title/artist, then find the video and confirm
it is the track before saving it — `https://www.youtube.com/oembed?url=<url>&format=json`
returns the real title and channel in one request, which is enough to catch a
wrong ID. Prefer the artist's or label's own upload. Update only the four `vibe_`
properties. No code edits, no assets and no new review are needed.

Run `npm run check` and a production build (`node scripts/isolated-build.mjs` if
dev is running), then commit only the completed track update; these commits are
authorized. Exclude unrelated worktree/index edits. Only use a path-specific
commit when the entire file diff is the intended change. Leave pushing to the
existing Obsidian Git workflow. Report the selected track and commit or blocker.

### Playback recovery

The capsule waits for the IFrame API’s `onReady` before issuing commands and
reads the current state there, since autoplay may have started before the API
attached. A blocked-autoplay event asks for a second explicit play press. A
network/player failure remounts a fresh iframe on retry, with a new 20-second
startup deadline; API loading also times out and can retry. Callbacks from old
attempts are ignored. Hiding cancels playback intent so a late ready event
cannot start music. Browser autoplay policy still applies (#168).
