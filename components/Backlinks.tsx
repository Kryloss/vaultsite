import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import type { Backlink } from "@/lib/backlinks";

/**
 * "Mentioned in" — the notes that link to this one, from lib/backlinks.ts.
 * Renders nothing when there are none, so a standalone note stays clean.
 */
export default function Backlinks({ links }: { links: Backlink[] }) {
  if (links.length === 0) return null;

  return (
    <aside className="backlinks">
      <h2 className="backlinks-title">
        <T {...ui.mentionedIn} />
      </h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="backlink">
              <span className="backlink-title">
                <T en={link.title} uk={link.titleUk} />
              </span>
              <span className="backlink-section">
                <T en={link.section} uk={link.sectionUk} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
