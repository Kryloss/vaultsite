/**
 * Section type registry — how a section lists its entries.
 *
 * A section's main.md picks its type via frontmatter:  type: posts
 * (defaults to "posts" when omitted).
 *
 * TO ADD A NEW PAGE STYLE (see docs/ADDING-PAGE-TYPES.md):
 * 1. Create a list component in components/lists/ that accepts { section, entries }.
 *    Sync or async server components both work.
 * 2. Register it below under a new key.
 * 3. Set `type: <key>` in the frontmatter of that section's main.md.
 * Nothing else needs to change — routing and rendering are type-agnostic.
 */
import type { ReactNode } from "react";
import type { Entry, Section } from "@/lib/vault";
import PostList from "@/components/lists/PostList";
import MusicList from "@/components/lists/MusicList";
import PeopleGrid from "@/components/lists/PeopleGrid";
import ShelfGrid from "@/components/lists/ShelfGrid";
import TilList from "@/components/lists/TilList";
import NowList from "@/components/lists/NowList";

export interface ListProps {
  section: Section;
  entries: Entry[];
}

/** Sync or async server component that renders a section's entry list. */
export type SectionList = (props: ListProps) => ReactNode | Promise<ReactNode>;

const registry: Record<string, SectionList> = {
  posts: PostList, // year-grouped rows + category filter chips
  music: MusicList, // Apple Music embeds + notes (reads `playlists:` frontmatter)
  people: PeopleGrid, // square cover-image grid (entries read `cover:` frontmatter)
  shelf: ShelfGrid, // 2:3 covers + medium chips (entries read `cover:`, `author:`, `medium:`)
  books: ShelfGrid, // legacy alias for shelf
  projects: TilList, // full entries rendered inline, TIL-style
  now: NowList, // nownownow-style status cards from `items:` frontmatter
};

export function getListComponent(type: string): SectionList {
  return registry[type] ?? PostList;
}
