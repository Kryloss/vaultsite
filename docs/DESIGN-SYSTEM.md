# Design system and `globals.css`

Read this before writing any CSS or any new UI. Tokens and the page shell are
summarised in `docs/ARCHITECTURE.md → Design system`; this file is the rules
that are not visible from the tokens themselves. Reasons: `docs/DECISIONS.md`
#51, #52, #55, #58, #59, #60, #61, #64, #81, #104, #107.

## Rules for any new UI

- **Never re-type a page container.** `components/Page.tsx` owns measure, gutters and rhythm (`--measure`, `--gutter`, `--page-y`). It used to be `max-w-2xl px-6 py-14 lg:py-24` copy-pasted into seven route files, two of which had already drifted (#58).
- **Use the tokens, don't type literals** (#58). Radius `--r-xs|sm|md|lg|xl|full` (4/6/8/12/16px + pill, equal to Tailwind's scale so the two can't drift). Motion `--ease` + `--dur-fast|--dur|--dur-slow` (120/200/320ms; Tailwind's `--default-transition-*` point at them, so utility classes move the same way). Surfaces: `--surface` is a card/cover/badge FILL, `--bg-hover` is the pointer response, `--chrome-bg`/`--chrome-ring` are the floating bars and pills (built from `--surface` in dark mode — a pill made of `--bg` is invisible on a dark page, #60).
- **Any new UI must work in both languages, light and dark, and under `prefers-reduced-motion`.** Using the tokens is what makes that nearly free. Check the result in both languages, light and dark, before calling it done.
- Give clickable things `press` (`press press-soft` for cards), and don't add `transition-colors` beside `.press` — it declares its own.
- Dark mode is `prefers-color-scheme` only — no manual toggle.
- Icons (`components/icons.tsx`) are **rendered in the sidebar only** — no icons on page content (#64). `resolveIcon()` maps vault frontmatter emoji/names → SVGs; unknown emoji render as text.

## Editing `globals.css`

- It has no `@layer`, so position is the tie-breaker — an override belongs BELOW what it overrides. This has caused four separate bugs (#51, #52, #55, #81), the subtlest being a `transition:` shorthand hundreds of lines above silently resetting a later `transform`.
- **A bare class selector here also beats a Tailwind utility of the same specificity**, so never set `position`, `display` or `width` on a class whose element carries a utility for it — `.chrome-bar { position: relative }` overrode `fixed` and dropped the floating breadcrumb into the page flow at full width (#81).
- The element carrying `.lang-en`/`.lang-uk` must NEVER be given a `display` — the language toggle hides the inactive one with `display: none`, and a bare rule at the foot of the file wins on position and paints both languages at once (it did, on the book spines — #110). Put the `display` on an inner element.
- **The design itself** lives in one block at the FOOT of `globals.css` (#59): Source Serif 4 for everything except code (sidebar and `svg.diagram text` included), big fluid `.page-title`, wide tonal range, dark mode with real elevation (`--surface` above `--bg`), demoted `.entry-meta`/`.entry-tags`, generous space above `h2`. It shipped as one of two switchable themes while the choice was being made; the switch and the losing design are deleted.
- **`.press`** (#55) dips a control to 97% while held; `.press-soft` (99%) for cards. Opt-in — a scaled inline prose link reads as a rendering fault. Named components join by selector at the very END of `globals.css`; don't move that block up. `.press:active` declares `transform` OUTRIGHT, so a component that composes its own transform (`.lightbox-arrow`, `.selection-pill`, `.book-spine`) has to restate the whole transform rather than set a variable.
- `.chrome-bar` and `.toc-bar` share a LAYERED blur — two masked pseudo-elements instead of a `backdrop-blur-*` utility — so their edges dissolve rather than ending at a hard rim. Their `z-index: -1` layers rely on each pill's own `z-index` for its stacking context — **never add `isolation: isolate`**, which forms a backdrop root and stops `backdrop-filter` sampling anything behind the element (#81). `.sidebar-panel` deliberately takes ONE even blur on the element itself: graduating it across 224px is wide enough to see as a seam down the middle.
- The drawer's hairline must stay an INSET `box-shadow`: an outset one leaves a 1px line down the left of the window whenever the panel is parked off-screen, and a shadow rather than a border costs no layout — the constellation's strip is measured against the full `w-56`. The modal backdrop covers the WHOLE viewport, panel included — two attempts to stop it at the panel's edge both produced a doubled edge (#74, #80, #81).
- Any `animation-timeline` declaration must sit inside `@supports`, or it falls back to the default TIME timeline and just plays once on load. Never put a scroll-driven animation on a property an element already transitions — the animation wins and the transition silently stops working (#81).
- A keyframe that names only `from` with `animation-fill-mode: both` ends on the element's OWN computed value — `wash-in` and `nav-tree-in` both rely on this. **Never add a `to:`** to either; it would flatten dark mode to the light value, or freeze one list's cap into the other's (#92, #124).
- `.stagger > *` carries `animation: item-in … both`, and an animation that fills forever on `opacity`/`transform` gives every child a PERMANENT stacking context — nothing inside one can outrank a later sibling. Put a z-index on the slot, not on what is inside it (#110).

## Breakpoints

- **The gutters arrive at 1168px**, not Tailwind's `xl` — the contents rail, sidenotes, pull-quotes, `.resume-reading`'s move under the rail, and the shelf note's gutter column all share that one query. It is DERIVED (39rem measure → 19.5rem half + 2.5rem gap + 13rem rail + 1.5rem margin = 73rem), so re-derive it if `--measure` or the rail's width changes rather than nudging it, and move all the queries together or the page goes lopsided (#107, #136).
- The music note's gutter PLAYER keeps 1400px — it takes 21rem + 20rem of LAYOUT past centre, since a transform shrinks paint and not layout (#99).
- 640px is the phone line (drawer tree, people cards, music pill, lightbox arrows, time-left chip); 480px is where the fact list runs on and the shelf card height steps down.

## Colour: monochrome, and the exceptions

Design is monochrome: no blue accent in hovers/active states. **There is no `--accent` token** — deleted after four passes trying to find the right amount of one colour (#64). State chips, the ToC marker, `[progress::]` and reading bars, focus rings, the selection wash and action links all use `--text`: on a page with no other colour, full text colour IS the emphasis. Callouts keep their four hues (there colour carries meaning). Active chips/nav use text-on-bg inversion.

The exceptions, all of them named:

- ONE hover-only exception (#56): the four platform icons take their brand colour (`.social-link[data-social]`, `--brand`, with near-white stand-ins for GitHub/X in dark mode; mail has no platform, so it keeps `var(--text)`). **There were TWO** — people photos sat at `grayscale(0.3)` (`.person-photo`) and returned to full colour on hover — and that half was removed at the owner's request (#125). The class is GONE. Don't reintroduce it, here or anywhere: every portrait on the site is now full colour at rest.
- The sidebar's flag-coloured line on Ukrainian CELEBRATION days (`--ua-blue`/`--ua-yellow`, #104) — one line, eight days a year, never an accent; the seven remembrance days stay monochrome on purpose. See `docs/CHROME.md`.
- **There is now a SECOND use of those tokens, and it is permanent**: the /music language button paints its label in the same gradient while **`RU`** is the selected step (#117). That was asked for directly and stretches #104 by exactly one exception — a third use would end the rule, so rewrite it rather than erode it again.
- A book spine's colour is computed per book from its own cover and does not flip with the theme; nothing there is the site's colour (#110).
- Draft's amber chip is a dev-only warning, not a published colour.

## Typeface

- **One typeface — Source Serif 4, everything except code**, self-hosted via `next/font` with the `cyrillic` subset AND `axes: ["opsz"]` (#61). Script coverage is a hard filter applied before a typeface is judged on looks: every note has a Ukrainian translation, and Newsreader was chosen and dropped for exactly this (#59). Quotes are the same family in italic — don't reach for a second family, that's what Lora was and it had to go.
- The build-time `next/og` renderer cannot read that CSS font registration, so `assets/fonts/` carries static regular and bold TTFs of the same family for shared-link cards only (#106).

## Verifying CSS

- **Verifying a Tailwind class actually shipped**: grep the built CSS for the ESCAPED form (`.w-\[calc\(…\)\]`), or read the element's computed style. A plain grep finds nothing whether or not the rule exists, and "nothing" looks exactly like "never emitted" (#54).
- Under `preserve-3d` a parent is a sibling plane, not a container — ask `elementFromPoint` what is really under the cursor before debugging the code that runs after the event. **A hit-testing fix verified in one engine is verified in one engine**: run anything that depends on hit-testing a 3D-transformed element in WebKit before believing it (#123).
- When an image looks broken, check the server and the lazy state before the markup (#104).
