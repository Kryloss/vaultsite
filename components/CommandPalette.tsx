"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchItem } from "@/lib/vault";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";

/**
 * Cmd/Ctrl+K search palette over the static, build-time index of every page.
 * No backend — the index arrives as props from the server layout.
 * Opened by hotkey (handled in Chrome) or the search button.
 */
export default function CommandPalette({
  items,
  open,
  onClose,
}: {
  items: SearchItem[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const { lang, toggle: toggleLang } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Focus after the element mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    const scored = items
      .map((item) => {
        // Match against both language titles + the folded-in text so a query
        // in either English or Ukrainian finds the page.
        const titles = [item.title, item.titleUk ?? ""].map((t) =>
          t.toLowerCase()
        );
        const sections = [item.section, item.sectionUk ?? ""].map((s) =>
          s.toLowerCase()
        );
        let score = 0;
        if (titles.some((t) => t.startsWith(q))) score = 4;
        else if (titles.some((t) => t.includes(q))) score = 3;
        else if (sections.some((s) => s.includes(q))) score = 2;
        else if (item.text.toLowerCase().includes(q)) score = 1;
        return { item, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((r) => r.item);
  }, [query, items]);

  useEffect(() => setSelected(0), [results.length, query]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-[var(--border)]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && results[selected]) {
                go(results[selected].href);
              }
            }}
            placeholder={ui.searchPlaceholder[lang]}
            className="w-full bg-transparent px-4 py-3.5 pr-12 text-[15px] text-[var(--text)] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <button
            type="button"
            onClick={toggleLang}
            aria-label={
              lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"
            }
            title={lang === "en" ? "English" : "Українська"}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-base leading-none transition-colors hover:bg-[var(--bg-hover)]"
          >
            {lang === "en" ? "🇨🇦" : "🇺🇦"}
          </button>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
              <T {...ui.noResultsFor} /> &ldquo;{query}&rdquo;
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => go(item.href)}
                onMouseEnter={() => setSelected(i)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-[15px] transition-colors ${
                  i === selected
                    ? "bg-[var(--bg-hover)] text-[var(--text)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate font-medium">
                  {lang === "uk" && item.titleUk ? item.titleUk : item.title}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  {lang === "uk" && item.sectionUk ? item.sectionUk : item.section}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-tertiary)]">
          <T {...ui.searchHint} />
        </div>
      </div>
    </div>
  );
}
