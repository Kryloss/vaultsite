"use client";

import { useRef, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { useLang } from "@/components/useLang";
import { shelfMatches } from "@/lib/shelf-search";

/**
 * One field that searches the whole shelf — page idea `shelfSearch`
 * (lib/site-config.ts, DECISIONS #180).
 *
 * The rows stay server-rendered; this only hides what doesn't match. Every
 * item carries its folded title and creator in `data-shelf-q` (ShelfGrid,
 * BookSpines), and a row with nothing left to show hides its heading too, so
 * typing "king" leaves one shelf with one book on it. Clearing the field puts
 * everything back exactly as it was. Escape clears it.
 */
export default function ShelfSearch() {
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();

  /* Applied from the handlers rather than an effect: hiding the rows is the
     response to a keystroke, not a state to keep in step. */
  const apply = (next: string) => {
    setQuery(next);
    const scope = rootRef.current?.parentElement;
    if (!scope) return;
    let shown = 0;
    for (const row of scope.querySelectorAll<HTMLElement>("[data-shelf-row]")) {
      let rowShown = 0;
      for (const item of row.querySelectorAll<HTMLElement>("[data-shelf-q]")) {
        const hit = shelfMatches(item.dataset.shelfQ ?? "", next);
        item.hidden = !hit;
        if (hit) rowShown++;
      }
      row.hidden = rowShown === 0;
      shown += rowShown;
    }
    setEmpty(next.trim() !== "" && shown === 0);
  };

  return (
    <div ref={rootRef} className="idea-shelf-search">
      <input
        type="search"
        value={query}
        onChange={(e) => apply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            apply("");
          }
        }}
        placeholder={ui.shelfSearchShort[lang]}
        aria-label={ui.shelfSearch[lang]}
        className="idea-shelf-search-input"
        autoComplete="off"
        spellCheck={false}
      />
      {empty && (
        <p className="idea-shelf-search-empty" role="status">
          <T {...ui.shelfNoMatch} />
        </p>
      )}
    </div>
  );
}
