# Diagrams & Excalidraw

The site renders two kinds of diagrams, both fully static (no runtime, no build-time canvas):

1. **Excalidraw drawings** you make in Obsidian — shown via the SVG the plugin exports.
2. **Self-theming SVGs** (often AI-generated) — a single SVG that adapts to light/dark on its own.

## 1. Excalidraw drawings from Obsidian

### One-time plugin setup

In Obsidian → Settings → **Excalidraw** → *Saving* (a.k.a. Embed & Export):

- Turn on **Auto-export SVG** ("Keep the exported SVG in sync with the drawing").
- Recommended: enable **both light and dark** exports (the plugin writes a
  `.light.svg` and a `.dark.svg`); the site then swaps them with your theme.
- Leave PNG off unless you specifically want raster.

That's it — every time you save a drawing, an SVG is written next to it.

### Drawing + embedding

1. Create a drawing anywhere in the vault (a central `Excalidraw/` folder is fine —
   the site finds drawings by name across every folder).
2. Embed it in any note the normal Obsidian way:

   ```md
   ![[My Diagram.excalidraw]]
   ![[My Diagram.excalidraw|A caption that appears under it]]
   ```

3. Push. The site shows the exported SVG (theme-aware if you exported both themes),
   centered, with your caption as a figcaption. Click to open it full-size.

If you see a dashed "isn't exported yet" note on the site, the drawing was pushed
without its SVG — open it once in Obsidian with Auto-export on, or export manually
(command palette → *Excalidraw: Export SVG*), and push the `.svg`.

> [!note] Why exported SVG, not the live drawing
> Rendering an Excalidraw scene needs the Excalidraw React app + canvas + fonts —
> too heavy for a static site. The exported SVG looks identical, loads instantly,
> and versions cleanly in git. See `docs/DECISIONS.md` #11.

## 2. Self-theming SVGs (AI diagrams)

For quick flow/architecture diagrams, a single SVG file with an internal
`@media (prefers-color-scheme: dark)` block adapts to the theme with no export
step. Drop the file in a section folder and embed it like any image:

```md
![[publishing-pipeline.svg|How a note becomes a page]]
```

A working example lives at `vault/Projects/attachments/publishing-pipeline.svg` (embedded in
the "This website" project). This is the format the AI workflow generates — see
`docs/CONTENT-WORKFLOW.md`.

**Self-theming SVGs are inlined into the page**, not loaded through an `<img>`
(`inlineSelfThemingSvg` in `lib/markdown.ts`) — through an `<img>` the browser
caches the rasterised result and freezes its `prefers-color-scheme` at first
decode, so a diagram gets stuck in the wrong theme. Two useful consequences:

- **Labels take the site's typeface.** `globals.css` styles `svg.diagram text`,
  which beats the `font-family` presentation attribute the file carries, so
  diagrams follow the site instead of drifting from it.
- **A two-file Excalidraw export can't do either.** It's a real `<img>`, so it
  keeps whatever font it was exported with and needs both light and dark files
  for the theme swap. That's a property of the embed, not a bug.

### Manual dark variants (any image)

Beyond Excalidraw, any embed gets a theme swap for free: if `chart.png` has a
sibling `chart.dark.png`, embedding `![[chart.png]]` shows the right one per theme.

## Translated diagrams (English / Ukrainian)

Diagrams swap with the site's language toggle, just like text. Add a Ukrainian
sibling and the site shows the right one automatically:

| Kind | English file | Ukrainian sibling |
|---|---|---|
| Self-theming SVG | `diagram.svg` | `diagram.uk.svg` |
| Excalidraw drawing | `Drawing.excalidraw` (→ exports) | `Drawing.uk.excalidraw` (→ exports) |

- Embed the **English** name as usual — `![[diagram.svg]]` or
  `![[Drawing.excalidraw]]`. The resolver finds the `.uk` sibling on its own.
- Each language still gets its own light/dark handling (self-theming SVGs theme
  internally; Excalidraw uses `.uk.light.svg` / `.uk.dark.svg`).
- **Bilingual caption:** put both languages in the alt, split by `::` —
  `![[diagram.svg|How it works :: Як це працює]]`. Only the active one shows.

If no `.uk` sibling exists, the English diagram shows in both languages (fine
for language-neutral pictures). Working examples: `vault/Projects/attachments/publishing-pipeline.svg`
(+`.uk.svg`) and `vault/Posts/rendering-pipeline.svg` (+`.uk.svg`).

## How it resolves (for maintainers)

- `lib/vault.ts → getAssetIndex()` maps every non-md file's basename to its
  `/vault-assets/…` URL, vault-wide (so name-based embeds work across folders).
- `lib/markdown.ts` turns `![[x.excalidraw]]` into a themed `<figure>`, trying
  `x.light.svg`/`x.dark.svg` → `x.svg` → `x.png`.
- `.excalidraw.md` source files are excluded from becoming pages; `.excalidraw`
  JSON sources aren't shipped (only the exported image is).
