"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ui } from "@/lib/ui-strings";
import { copyText } from "@/lib/clipboard";

/**
 * Copy-to-clipboard buttons for build-time-highlighted code blocks.
 *
 * The buttons are injected here rather than baked into the markdown HTML so a
 * visitor without JavaScript never sees a dead control. Re-runs on navigation
 * (App Router swaps the article HTML without remounting this component).
 *
 * The accessible label is a pair of .lang-en / .lang-uk spans — the language
 * toggle hides one with `display: none`, which also removes it from the
 * accessibility tree, so the button announces in exactly one language.
 */
const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

const DONE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

export default function CodeCopy() {
  const pathname = usePathname();

  useEffect(() => {
    const timers: number[] = [];

    const blocks = Array.from(
      document.querySelectorAll<HTMLElement>(".prose figure.code-block")
    );

    for (const block of blocks) {
      if (block.querySelector(".code-copy")) continue; // already wired

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.innerHTML =
        COPY_ICON +
        DONE_ICON +
        `<span class="code-copy-label lang-en"></span>` +
        `<span class="code-copy-label lang-uk"></span>`;

      // textContent assignment avoids injecting strings as markup.
      const [en, uk] = Array.from(
        btn.querySelectorAll<HTMLElement>(".code-copy-label")
      );
      if (en) en.textContent = ui.copyCode.en;
      if (uk) uk.textContent = ui.copyCode.uk;

      btn.addEventListener("click", async () => {
        const pre = block.querySelector("pre");
        if (!pre) return;
        const ok = await copyText(pre.innerText.replace(/\n$/, ""));
        if (!ok) return;

        btn.classList.add("is-copied");
        if (en) en.textContent = ui.copiedCode.en;
        if (uk) uk.textContent = ui.copiedCode.uk;

        timers.push(
          window.setTimeout(() => {
            btn.classList.remove("is-copied");
            if (en) en.textContent = ui.copyCode.en;
            if (uk) uk.textContent = ui.copyCode.uk;
          }, 1600)
        );
      });

      block.appendChild(btn);
    }

    return () => timers.forEach(clearTimeout);
  }, [pathname]);

  return null;
}
