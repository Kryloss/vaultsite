"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/icons";
import { useLang } from "@/components/useLang";
import { copyText } from "@/lib/clipboard";
import { ui } from "@/lib/ui-strings";

/**
 * Copies the note's raw markdown — the source as it exists in the vault, not
 * the rendered HTML. Follows the active language, so the Ukrainian body is
 * what you get with the site in Ukrainian.
 *
 * The markdown ships inline as props rather than being fetched: it's the same
 * text the page already renders, and the Cmd+K search index in every page is
 * larger than this by a wide margin.
 */
export default function CopyMarkdown({ en, uk }: { en: string; uk?: string }) {
  const { lang } = useLang();
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const source = lang === "uk" && uk ? uk : en;
    if (!(await copyText(source.trim()))) return;
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };

  const label = done ? ui.copiedCode[lang] : ui.copyMarkdown[lang];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="copy-md"
    >
      {done ? (
        <CheckIcon className="h-full w-full" />
      ) : (
        <CopyIcon className="h-full w-full" />
      )}
    </button>
  );
}
