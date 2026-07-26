"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import type { Heading } from "@/lib/toc";

/**
 * Table of contents — a fixed rail to the right of the article on wide screens,
 * hidden below the width where it would crowd the text (see .toc-rail in
 * globals.css).
 *
 * Bilingual like everything else: both outlines ship in the HTML and CSS shows
 * the active one. The scroll-spy walks the merged list and skips anything whose
 * language is currently hidden — a display:none heading has no offsetParent, so
 * the check costs nothing and keeps one observer serving both languages.
 */
export default function Toc({ en, uk }: { en: Heading[]; uk?: Heading[] }) {
  const [active, setActive] = useState("");
  const ids = [...en, ...(uk ?? [])].map((h) => h.id).join(",");

  useEffect(() => {
    const list = ids.split(",").filter(Boolean);
    let frame = 0;

    const measure = () => {
      frame = 0;
      let current = "";
      for (const id of list) {
        const el = document.getElementById(id);
        // offsetParent is null for the hidden language's headings.
        if (!el || el.offsetParent === null) continue;
        // Last heading that has crossed the top of the reading area wins.
        if (el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);

  const list = (headings: Heading[], langClass: string) => (
    <ul className={langClass}>
      {headings.map((h) => (
        <li key={h.id} data-level={h.level}>
          <a
            href={`#${h.id}`}
            className={h.id === active ? "toc-link is-active" : "toc-link"}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <nav className="toc-rail" aria-label="Table of contents">
      <p className="toc-title">
        <T {...ui.onThisPage} />
      </p>
      {/* Without a translated body there's one outline, shown in both modes. */}
      {uk ? (
        <>
          {list(en, "lang-en")}
          {list(uk, "lang-uk")}
        </>
      ) : (
        list(en, "")
      )}
    </nav>
  );
}
