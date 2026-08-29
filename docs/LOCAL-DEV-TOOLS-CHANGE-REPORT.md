# Local Dev-Tools Change Report

Audience: Claude Code / the next agent working on Vaultsite
Date: 2026-08-29
Scope: localhost-only authoring controls for the static Obsidian-backed site

## Executive summary

The local development preview now includes a small authoring dock. It is
available only when all of the following are true:

- the site is running in development mode;
- the browser hostname is exactly localhost;
- the local editor sidecar is running through npm run dev.

The collapsed dock is a single pencil at the bottom-right. The public page and
the normal site chrome are unchanged while it is collapsed. Expanding it shows:

- a link to the configured public equivalent of the current route;
- an Open this file in Obsidian link for the active language;
- English/Ukrainian language switching;
- direct title and description editing where those strings render;
- an in-place Markdown source editor when the current page's prose is selected;
- a draggable/keyboard-editable rating control on movie/show Top-list rows;
- a contextual `+` on Posts, Music, People, Shelf and Projects section pages;
- Draft/category/Post-series options beneath entry headers;
- direct EN/UK goal checkboxes on the Now page;
- Undo, Redo, Cancel, Save, and reload/retry actions;
- one shared draft/history across page metadata and both language bodies.

The editor writes the real Markdown sources in `vault/`. Frontmatter edits
preserve unrelated bytes, while prose is edited as exact Markdown rather than
as lossy rendered HTML. The primary and Ukrainian body files are revision-
checked and staged together. Attachments remain in Obsidian until their
asset-copy/manifest/rollback transaction is designed.

## User-facing behavior

### Collapsed state

components/DevTools.tsx renders one pencil button in the bottom-right corner.
The dock is absent outside exact localhost development, and the collapsed state
does not add a public-page button to the coordinate/breadcrumb bar.

The icon buttons are intentionally transparent: the shared dock surface remains,
but individual icons do not gain a colored background on hover.

### Expanded state

The dock expands horizontally into the tool bar. It no longer duplicates the
page's title and description inside a form panel. Instead, the visible title
and description become plain-text edit targets. A small feedback card appears
only for loading, save confirmation, errors, retry, or revision reload.

The shared draft contains:

    title
    title_uk
    description
    description_uk
    body
    body_uk

Clicking the page-owned prose swaps that `<article>` for a Markdown textarea in
the same location and with the article's previous minimum height. This is a
source editor by design: reverse-converting edited HTML would damage wiki
links, embeds, callouts, tables, footnotes, and Obsidian syntax. External Apple
Music/YouTube controls, generated dates/counts/navigation, and lists projected
from other notes remain read-only. The dock's icon buttons remain transparent;
only the shared bar has a surface.

The Top-list editor adds the numeric rating field separately:

    rating

Top-list rows can also be dragged while the dock is expanded. A drop persists
the complete visible order as consecutive zero-based `top_order` fields across
the participating movie/show notes, so later rating changes do not reshuffle a
manually arranged list. The sidecar stages the files together, rechecks every
source before replacement, and restores backups if a filesystem error interrupts
the final pass.

An absent Ukrainian metadata value remains absent until the user enters one;
the English value is shown as an inline placeholder rather than silently
copied into the source.

### Contextual creation and structured options

The expanded dock also sets `data-dev-tools` on `<html>`. Development-only
page islands observe that state and render beside the thing they own:

- Posts, Music, People, Shelf and Projects show a small `+` beside the section
  title. It opens a bilingual, type-specific Draft form on the page itself.
- Every new pair starts with `draft: true`; its English primary holds
  frontmatter/body and its `.uk.md` sibling holds the Ukrainian body.
- Shelf chooses Book/Movie/Show/Video and writes into the matching filing
  folder. Music also captures artist, format, ENG/UA/RU shelf, optional Apple
  genres and an optional Apple Music URL. Video scaffolds accept YouTube URLs.
- Entry pages expose Draft state and, where the section supports them,
  existing/new `#` categories. Posts additionally expose a vault-wide series,
  the one shared Ukrainian series name, and an optional part number.
- A new category needs no code to be valid, but its display label falls back
  to English in Ukrainian until `lib/categories.ts` gains a translation.
- Now goal boxes become real checkbox controls while expanded. They update the
  matching task marker in English and Ukrainian together without rewriting the
  task text.

The `+`, options and checkbox semantics disappear again when the pencil is
closed. All contextual actions refuse to run while the main title/body editor
has an unsaved draft or a save in flight.

The public link uses lib/site-config.ts's canonical siteUrl (https://kryloss.com),
preserves the current pathname/query/hash, and normalizes the lang query for
the selected language. It does not invent or switch to a www origin.

The Obsidian link is returned by the sidecar as an encoded absolute-path URI.
When the Ukrainian sibling exists, the Ukrainian button targets that sibling;
otherwise it falls back to the primary English source. Both language metadata
sets live in the primary file's frontmatter.

On the unfiltered movie and show Top lists, the stars become an editable
half-star slider while the dock is expanded. Dragging across the stars chooses
0–5 in half-star increments; keyboard arrows move by half a star, Home/End jump
to 0 or 5, and Delete/Backspace clears the rating. Clicking elsewhere on the
row still opens the note. The same rows can be dragged into a manual order;
the complete order is written as `top_order` metadata, and then takes precedence
over rating/IMDb/date. The drag controller suppresses link navigation only
after movement crosses its threshold, so a normal click keeps opening the note.

## Client implementation

### Main components and helpers

- components/DevTools.tsx — client controller for the dock, direct
  contenteditable metadata targets, the in-article Markdown portal, route
  detection, loading/saving, draft retention, and keyboard behavior.
- components/DevToolsSlot.tsx — development-only server slot; dynamically
  imports the client dock only in development.
- components/DevToolsDisabled.tsx — production null replacement.
- components/DevRatingEditor.tsx — localhost-only Top-list star slider.
- components/DevRatingEditorSlot.tsx — development import/production static-star fallback.
- components/DevRatingEditorDisabled.tsx — production null replacement for the
  rating editor import.
- components/DevTopReorder.tsx — localhost-only pointer drag controller for Top-list rows.
- components/DevTopReorderSlot.tsx — development import/production null slot.
- components/DevTopReorderDisabled.tsx — production null replacement for the
  reorder controller import.
- components/DevCreateEntry.tsx / DevCreateEntrySlot.tsx — page-level new-entry
  dialog and development-only server slot.
- components/DevEntryOptions.tsx / DevEntryOptionsSlot.tsx — Draft,
  category and Post-series frontmatter controls.
- components/DevNowGoalToggle.tsx / DevNowGoalToggleSlot.tsx — localhost Now
  checkbox and production/static fallback.
- components/DevNowGoalToggleSlotDisabled.tsx — production static goal marker;
  it preserves the ordinary checked state without importing editor code.
- components/useDevToolsExpanded.ts — observes the dock's HTML state for
  contextual islands.
- lib/dev-editor-client.ts — shared loopback session/request client for those
  islands.
- lib/dev-tools.ts — pure availability, URL, language-source, reducer, dirty,
  and change-set helpers.
- lib/dev-tools.test.ts — helper/reducer/URL tests.
- components/icons.tsx — Undo, Redo, Save, Obsidian, and Reload icons.
- lib/ui-strings.ts — local bilingual strings are kept in the separate
  devUi export, away from the public fixed-string object.

### Source markers

The server-rendered pages expose known authoring sources through dock-only data
attributes. They are present on:

- the home page;
- normal section pages;
- shelf medium/category pages (which point to the section main.md);
- entry pages;
- the rendered title/description fields used as direct editing targets;
- each English/Ukrainian page-owned prose article through
  `data-dev-body-field="body|body_uk"`.

The existing data-vault-source marker used by the public GitHub/open-note action
remains separate. The writer never derives a file path from the URL.

### Draft and navigation behavior

- Metadata keystrokes and Markdown input are grouped for practical Undo/Redo
  steps in the same history.
- Undo/Redo/Cancel only change browser state.
- Save after an Undo is still required before a reversal reaches disk.
- Dirty drafts are retained in a module-level map by source across soft
  navigation and restored when the source is revisited. The retained snapshot
  includes both the primary and Ukrainian revisions, so an old translation
  cannot be saved against a newly loaded sibling revision.
- Hard reloads use beforeunload protection.
- Ordinary same-origin anchor navigation prompts before discarding a dirty draft;
  modifier/new-tab/download/external links are not intercepted.
- A save in flight blocks ordinary navigation and validates both the current
  route generation and current DOM source marker before writing.
- Route changes clear the writable model immediately, then read the newly
  committed source marker on the next animation frame.
- Initial connection failures provide Retry; revision conflicts provide Reload.
- Closing the dock restores the saved baseline to the visible page while
  retaining an unsaved draft in memory; reopening reveals the draft again.
- Cmd/Ctrl+S uses the repository's shortcutKey() helper, so it works under a
  Ukrainian keyboard layout as well as Latin layouts.

## Sidecar architecture

### Process model

package.json now runs:

    npm run dev -> node scripts/dev.mjs

scripts/dev.mjs supervises two children:

1. Next.js development server;
2. scripts/dev-editor.mjs, the loopback writer.

The sidecar listens on 127.0.0.1. Next adds the /__vault-editor/:path* rewrite
only when NODE_ENV is development. The editor refuses to start when explicitly
invoked with NODE_ENV=production.

The sidecar is a separate Node process and does not hot-reload when its script
changes. After adding or changing an editor endpoint, restart the complete
preview with `npm run dev`; an old process will otherwise return 404 for the
new endpoint. Direct page editing uses `/page-document` and `/save-page`;
contextual authoring adds `/create-entry` and `/toggle-now-goal`; structured
entry options continue through revision-checked `/document` and `/save`.

### HTTP protections

scripts/dev-editor-server.mjs enforces:

- the supervisor-provided exact origin (http://localhost:<port> or HTTPS when
  requested);
- same-origin Origin/Referer metadata rules;
- a random in-memory session token sent in X-Vault-Editor-Token;
- exact application/json requests;
- bounded JSON request bodies;
- no CORS headers;
- supported methods only.

The integration tests cover exact localhost acceptance, numeric loopback and
foreign-origin rejection, missing/contradictory metadata, authentication,
malformed/oversized JSON, unsupported methods, and read/save/reorder behavior.

### Filesystem and save safety

scripts/dev-editor-core.mjs:

- accepts only existing POSIX .md paths beginning with vault/;
- rejects traversal, empty segments, backslashes, NUL bytes, and non-Markdown
  paths;
- resolves the repository, vault, candidate, and symlink target with realpath;
- verifies the final file remains inside vault/;
- reads the exact source and calculates a SHA-256 revision;
- patches only the supported top-level frontmatter keys;
- reads the primary Markdown body after its closing frontmatter fence and the
  Ukrainian sibling as a body-only file;
- accepts bounded, NUL-free Markdown bodies and preserves each file's newline
  convention;
- accepts the validated numeric rating field (0–5, half-star increments) and
  non-negative `top_order` positions for Top-list reordering;
- validates Draft/published, singular/multiple category, Post-series and part
  fields without reserialising unrelated YAML;
- creates only under a real supported top-level section, rejects unsafe file
  names plus filename/route-slug collisions, and creates the EN/UK pair with
  exclusive destinations and rollback;
- toggles only a top-level task under the Now Goals heading, checks the rendered
  label for stale order/text, and saves both languages atomically;
- rejects duplicate editable keys, invalid YAML, empty English titles,
  multiline/overlong titles, and overlong descriptions;
- preserves unrelated YAML keys, comments, ordering, line endings, and BOMs;
- writes through uniquely named siblings, fsyncs, rechecks revisions, and
  atomically renames replacements into place; page saves and multi-file
  reorders stage backups so an interrupted rename pass can be restored.

For a page save, both the primary revision and the optional Ukrainian revision
must match. Metadata and the English body are composed into one primary-file
replacement; the Ukrainian body is a second staged replacement. The complete
snapshot is rechecked before either rename and the backup pass makes the save
all-or-nothing across the pair.

If the file changed in Obsidian after the browser loaded it, the sidecar returns
a revision conflict. The browser keeps the draft and requires an explicit
reload, so it never silently overwrites the newer source.

## Production isolation

next.config.ts contains three independent production safeguards:

1. the development rewrite is omitted outside development;
2. the production webpack configuration aliases the main editor and contextual
   server slots to null/static replacements;
3. the slots retain their own development checks as a runtime fallback.

The production build was inspected after generation. It contained no editor
rewrite, editor App Router route, editor token header, editor endpoint/UI string,
or contextual editor client implementation in generated JavaScript. Static HTML
contained no `+`, Page options, or checkbox controls. The build trace still names
the source-side slot modules as inputs, but not their client implementations.
The dormant development CSS selectors remain harmlessly in the global stylesheet
because they have no mounted component in production.

The site remains static in production: no runtime filesystem reads, server
actions, database, or deployed write endpoint were added.

## Documentation updated

- AGENTS.md — local npm run dev sidecar exception and decision reference.
- CLAUDE.md — local authoring dock inventory, direct-edit source boundary, and
  deferred attachment scope.
- docs/ARCHITECTURE.md — static-site exception for the loopback writer.
- docs/DECISIONS.md — decisions #118–119 and #122, including the security model,
  in-place Markdown source boundary, revision handling, rating/reordering, and
  contextual creation/options/Now editing.

## Verification

Checks performed after the contextual-authoring extension:

- `npm test` — 242 passed, 0 failed;
- focused editor core/server tests — 27 passed, 0 failed;
- `npx tsc --noEmit` — passed;
- an isolated `NEXT_TELEMETRY_DISABLED=1 npm run build` — passed, generating
  240 static pages without replacing the owner's running development build;
- production bundle/manifest/HTML audit — no editor rewrite, endpoint strings,
  contextual client implementation, or mounted authoring controls;
- `git diff --check` — passed.

The focused coverage includes safe bilingual creation templates, filename and
route-slug collision rejection, raw-YAML frontmatter normalization, paired Now
task toggles and rollback/stale-label guards, plus their protected HTTP
endpoints. The complete suite also retains body/frontmatter byte separation,
CRLF preservation, body-size/NUL validation, two-language save, stale revision,
and shared Undo/Redo coverage.

Browser inspection confirmed that Posts has no `+` while collapsed and gains its
type-specific dialog beside the title when expanded; entry Page options expose
Draft, category, and Post-series fields; Now gains three semantic checkbox
controls only while expanded and keeps linked goals as sibling links. Music and
Shelf showed their specialized fields, selecting Video revealed its YouTube URL,
and the Shelf dialog remained usable at 390×844. The inspected dark-scheme views
had no browser console errors or warnings. A light-scheme visual pass was not
available without changing the owner's system setting; these controls use the
existing scheme tokens. No form was submitted and no vault content file was
modified. Restart `npm run dev` once before using the new write actions because
the already-running sidecar predates their endpoints and does not hot-reload.

## Known limits and follow-up

1. “All text” means text owned by the current page source. Generated list rows,
   dates, counts, navigation, creator/fact labels, and third-party widget UI are
   deliberately read-only. Editing those projections would require opening
   other documents or changing code/data rather than editing this page.
2. Markdown prose edits in source mode rather than WYSIWYG. That is the
   fidelity contract that preserves Obsidian syntax; rendered HTML has no
   faithful inverse mapping.
3. Attachments are not implemented. A safe attachment flow needs coordinated
   asset copy, Markdown update, image-manifest regeneration, cache invalidation,
   collision handling, and rollback.
4. The Obsidian button remains the intended handoff for attachments, structured
   frontmatter outside the supported fields, and multi-note generated content.
5. Always use npm run dev, not bare next dev, or the sidecar/rewrite will not
   be available.
6. The checkout also contains separate note-cover/header/gutter work in
   progress. It is not part of this editor extension; preserve and review it as
   its own change rather than resetting shared route or CSS files wholesale.

## Handoff recommendation

Treat docs/DECISIONS.md #118–119/#122 and this report as the implementation contract.
If extending the dock, keep the exact-hostname gate, sidecar separation,
source-marker boundary, revision check, atomic write, bilingual UI, and
production webpack replacement intact. Keep the Markdown source-in-place
boundary if editing expands, and revisit attachments only after their
asset/manifest transaction is written down and tested.
