# Verify loop

Run before handing off any code or content change. Report exactly which checks ran and any failures; do not claim a check passed unless you ran it successfully.

## The commands

```bash
npm run check
```

`check` runs, in order: `typecheck` (`tsc --noEmit`), `test`, and `validate:image-notes`. Then, separately:

```bash
npm run build
```

- **`npm run typecheck`** — `tsc --noEmit` over the whole tree (strict mode, `@/*` alias). Fast, and the only thing that reads every `.tsx` at once.
- **`npm test`** — Node's own runner (no framework) over `lib/*.test.ts` **and `scripts/*.test.mjs`**, wired through `--import ./scripts/test-hooks.mjs`, which registers `scripts/test-resolve.mjs` on the loader thread to teach it the `@/` alias and extensionless imports. This includes `scripts/docs.test.mjs`, which checks that CLAUDE.md and AGENTS.md route to the same set of `docs/*.md` files, that every file they name exists, and that every `DECISIONS #N` reference in code, docs and the vault resolves to a heading in `docs/DECISIONS.md`.
- **`npm run validate:image-notes`** — gates both `predev` and `prebuild`, so a broken image note fails `dev` and `build` before Next.js starts. Run it directly when iterating on an image note.
- **`npm run build`** — first validates image notes and syncs vault assets, then statically generates every route. Required because it catches broken content, imports, and static params that unit tests cannot. It is not part of `check` because of the clash below.
- **`npm run lint`** — `eslint .` with Next's flat configs (`eslint-config-next/core-web-vitals` + `/typescript`, `eslint.config.mjs`). `next lint` is deprecated in Next 15.5 and removed in 16, so the CLI is used directly. Advisory: see the foot of this file.

## The build clashes with the dev server

`next build` and `next dev` share `.next/`. Running the build while `npm run dev` is up corrupts the dev server's output (and a second dev server does the same). Either stop the dev server first, or build an isolated copy:

```bash
node scripts/isolated-build.mjs
```

That copies the tree (minus `node_modules`, `.next`, `.git`) into a temp directory, symlinks `node_modules`, and runs `npm run build` there with telemetry off. It leaves the running dev server alone and prints the page count on success.

## What a UI change also needs

- Look at the affected view in **both languages, light and dark**, at a phone width, a laptop width and above 1168px, and under `prefers-reduced-motion`. If the available environment cannot perform a visual check, say so.
- Anything that depends on hit-testing a 3D-transformed element has to be run in **WebKit** before it is believed (`docs/MUSIC.md`).
- To verify a Tailwind class shipped, grep the built CSS for its ESCAPED selector or read the computed style; a plain grep produces a false negative (`docs/DESIGN-SYSTEM.md`).
- A number about someone else's layout (Apple's player) is read out of that layout's DOM, not off a screenshot, and in every state it can be in — press Play first (`docs/MUSIC.md`).
- Check that a reference resolves AND that the thing on the other end is what it claims to be: a downloaded image that exists, syncs and renders can still be YouTube's default avatar (`docs/CONTENT-WORKFLOW.md` step 6).

## Docs are part of the change

Change a convention, command, or invariant → update `CLAUDE.md` and `AGENTS.md` together (they are indexes; the detail lives in the `docs/*.md` file they route to), plus `docs/DECISIONS.md` if the choice is non-obvious. Where prose disagrees with code, the code wins — flag it in the doc rather than "fixing" the code to match a stale sentence.

## Lint status

**Not in `check`.** The baseline on 2026-09-06, the day lint was added, was 34 errors and 15 warnings across 24 files, none of them touched by that change: 23 × `react-hooks/set-state-in-effect` (mostly the deliberate `everOpen` gates on always-mounted dialogs — `docs/CHROME.md`), 6 × `react-hooks/refs`, 2 × `react-hooks/immutability`, 1 × `react-hooks/static-components`, 2 × `@typescript-eslint/no-explicit-any` in `lib/markdown.ts`, plus unused-var, exhaustive-deps and `no-img-element` warnings. Most are the React Compiler rules that `eslint-config-next@16` turns on, judging patterns this codebase chose on purpose; whether to fix, suppress per line, or disable those rules is a decision, not cleanup, and belongs to a change of its own. Until the baseline is clean: run `npm run lint` by hand, report new findings in files you touched, and don't fix pre-existing ones as part of an unrelated change. When it IS clean, add `npm run lint` to `check` and delete this paragraph.
