/**
 * Section type registry — how a section lists its entries.
 *
 * A section's main.md picks its type via frontmatter:  type: posts
 * (defaults to "posts" when omitted).
 *
 * TO ADD A NEW PAGE STYLE (see docs/ADDING-PAGE-TYPES.md):
 * 1. Create a list component in components/lists/ that accepts { section, entries }.
 * 2. Register it below under a new key.
 * 3. Set `type: <key>` in the frontmatter of that section's main.md.
 * Nothing else needs to change — routing and rendering are type-agnostic.
 */
import type { ComponentType } from "react";
import type { Entry, Section } from "@/lib/vault";
import PostList from "@/components/lists/PostList";
import MusicList from "@/components/lists/MusicList";

export interface ListProps {
  section: Section;
  entries: Entry[];
}

const registry: Record<string, ComponentType<ListProps>> = {
  posts: PostList,
  music: MusicList, // Apple Music embeds + notes (reads `playlists:` frontmatter)
  // projects: ProjectGrid,   ← future example
};

export function getListComponent(type: string): ComponentType<ListProps> {
  return registry[type] ?? PostList;
}
