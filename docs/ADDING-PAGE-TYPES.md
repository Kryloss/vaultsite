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
            className="block rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--bg-hover)]"
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

- Reuse the CSS variables (`--text`, `--border`, `--bg-hover`, `--accent`) so new types match both themes automatically.
- Keep list components server-compatible (no hooks) unless interactivity is truly needed.
- Document any new frontmatter keys in README.md and CLAUDE.md.
