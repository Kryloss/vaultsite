# Adding a new page type

Section pages can list their entries in different styles. The style is chosen by the `type` frontmatter key in the section's `main.md` and resolved through the registry in `lib/section-types.tsx`. Routing, markdown rendering, and the sidebar are type-agnostic — adding a style touches exactly three places.

## Example: a "projects" grid

**1. Create the list component** — `components/lists/ProjectGrid.tsx`:

```tsx
import Link from "next/link";
import type { ListProps } from "@/lib/section-types";

export default function ProjectGrid({ section, entries }: ListProps) {
  return (
    <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {entries.map((e) => (
        <li key={e.slug}>
          <Link
            href={`/${section.slug}/${e.slug}`}
            /* `press press-soft` gives the card the site's pressed state — see
               Guidelines. No `transition-colors`: `.press` already declares the
               transition, including the colour properties. */
            className="press press-soft block rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--bg-hover)]"
          >
            <span className="font-medium text-[var(--text)]">{e.title}</span>
            {e.description && (
              <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                {e.description}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**2. Register it** in `lib/section-types.tsx`:

```tsx
import ProjectGrid from "@/components/lists/ProjectGrid";

const registry: Record<string, ComponentType<ListProps>> = {
  posts: PostList,
  projects: ProjectGrid,
};
```

**3. Use it from Obsidian** — `vault/Projects/main.md`:

```md
---
title: Projects
icon: 🛠️
order: 2
type: projects
description: Things I've built.
---
```

Push, and `/projects` renders as a grid. Unknown types fall back to `PostList`, so a typo never breaks the build.

## If a type needs extra per-entry data

Add frontmatter keys to the entry notes (e.g. `url:`, `tech:`) and read them where needed. To surface new keys in the `Entry` object, extend the interface and the mapping in `lib/vault.ts → getEntries()`. Keep new keys optional so existing content never breaks.

## Guidelines

- **A list component never sets its own page container.** The route already wraps everything in `components/Page.tsx`, which owns the measure, gutters and vertical rhythm. Start at `mt-8` and let the shell handle the edges.
- **Use the tokens, don't type literals.** Colour (`--text`, `--text-secondary`, `--border`, `--surface`, `--bg-hover`), radius (`--r-sm` … `--r-full`, or the equivalent Tailwind `rounded-*` classes), motion (`--ease`, `--dur-fast`, `--dur`, `--dur-slow`). This is what makes a new type follow light and dark without you doing anything. See `docs/ARCHITECTURE.md` → Design system.
- **`--surface` for a card's fill, `--bg-hover` for its hover.** They're the same grey today and are separate tokens precisely so they can stop being.
- **Give every clickable thing `press`** (or `press press-soft` for anything card-sized). It's the site's one piece of tap feedback and the only response a phone gets before the next page paints. Don't add `transition-colors` alongside it — `.press` declares the transition itself, colours included.
- **Don't hard-code a typeface.** The family is set on `body` and everything inherits it; a `font-*` utility would opt your component out of the site's voice.
- Keep list components server-compatible (no hooks) unless interactivity is truly needed. If a type needs the URL (filter chips, say), split it: a presentational half plus a thin client wrapper, like `PostRows` / `PostListClient`.
- Check it in **both languages, light and dark**, and under `prefers-reduced-motion`, before calling it done.
- Document any new frontmatter keys in README.md and CLAUDE.md.
