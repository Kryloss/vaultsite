/**
 * The sidebar's second level — the vault's own folders, in the drawer.
 *
 * OBSIDIAN'S TREE, NOT A NEW ONE. The rule is the same one the site is built
 * on: a top-level folder is a section, and what's inside it is what the
 * sidebar shows. `vault/Shelf/` has Books, Movies, Shows and Videos in it, so
 * the Shelf row opens onto four folders; `vault/Music/` has no subfolders at
 * all (`covers/` is filing, and DECISIONS says a subfolder is never a page),
 * so the Music row opens straight onto its notes. Nothing here invents a
 * grouping the vault doesn't have — an artist tier under Music and a category
 * tier under Posts were both considered and both refused for that reason:
 * they'd be folders with no folder and, worse, no page to tap through to.
 *
 * WHY IT'S BUILT FOR EVERY SECTION AND SHOWN FOR ONE. `app/layout.tsx` has no
 * pathname — layouts don't get one — so the choice of which subtree to draw
 * belongs to `components/Chrome.tsx`, which is a client component and can ask.
 * The whole tree therefore crosses into the payload and only the section
 * you're in reaches the DOM. It's about a hundred titles; the constellation
 * already ships six months of them the same way.
 *
 * BUILD TIME, like everything else that reads the vault. This file imports
 * `fs` through lib/vault and must never be pulled into a client component.
 */
import { getEntries, type Section } from "./vault";
import { isShelfSection, shelfGroups } from "./shelf";
import { sidebarTree } from "./site-config";
import type { Str } from "./ui-strings";

/** A leaf: one note, one URL. */
export interface NavNote {
  href: string;
  title: string;
  titleUk?: string;
}

/** A real vault subfolder that is also a real page — currently only a medium. */
export interface NavFolder {
  /** URL segment, e.g. "books". Doubles as the disclosure's identity. */
  slug: string;
  /** `/shelf/type/books` — where tapping the NAME goes. */
  href: string;
  label: Str;
  notes: NavNote[];
}

/**
 * What a section row opens onto. Both halves can be present: a shelf note
 * filed at the section root belongs to no medium, so it hangs under the
 * folders rather than vanishing from the tree.
 */
export interface NavChildren {
  folders?: NavFolder[];
  notes?: NavNote[];
}

/**
 * Section types whose notes hang directly off the section row.
 *
 * `now` is the only one left out, and not by taste: it is a single page with
 * no entries at all, so there is nothing to hang there.
 */
const FLAT_TYPES = new Set(["posts", "music", "projects", "people"]);

function noteOf(sectionSlug: string, note: { slug: string; title: string; titleUk?: string }): NavNote {
  return {
    href: `/${sectionSlug}/${note.slug}`,
    title: note.title,
    titleUk: note.titleUk,
  };
}

/**
 * The subtree under one section row, or undefined when it hasn't got one.
 *
 * Home is excluded by slug rather than by type: it has no `type:` of its own
 * and would otherwise fall through to the posts default, putting the site's
 * front page in the tree as a folder of its own notes.
 */
export function navChildren(section: Section): NavChildren | undefined {
  // THE ONE SWITCH. Off, this returns nothing for every section, so no
  // subtree is built, none is serialized into any page's payload, and
  // components/Chrome.tsx has nothing to draw — see lib/site-config.ts.
  if (!sidebarTree) return undefined;
  if (section.slug === "home") return undefined;

  const entries = getEntries(section);
  if (entries.length === 0) return undefined;

  if (isShelfSection(section)) {
    const groups = shelfGroups(entries);
    const folders: NavFolder[] = [];
    let loose: NavNote[] | undefined;

    for (const group of groups) {
      const notes = group.items.map((item) => noteOf(section.slug, item));
      // `shelfGroups` puts mediumless notes in an "unsorted" bucket, and
      // `shelfMediumSlugs` deliberately keeps that bucket out of
      // `generateStaticParams` — so it has no page and can't be a folder here
      // either. Its notes still have their own pages, so they hang loose.
      if (group.medium === "unsorted") {
        loose = notes;
        continue;
      }
      folders.push({
        slug: group.slug,
        href: `/${section.slug}/type/${group.slug}`,
        label: group.label,
        notes,
      });
    }

    if (folders.length === 0 && !loose) return undefined;
    return { folders: folders.length ? folders : undefined, notes: loose };
  }

  if (!FLAT_TYPES.has(section.type ?? "posts")) return undefined;
  return { notes: entries.map((entry) => noteOf(section.slug, entry)) };
}
