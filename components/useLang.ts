"use client";

import { useEffect, useState } from "react";

export type Lang = "en" | "uk";

/**
 * Shared language state for the toggle(s). The active language lives on
 * <html data-lang> (CSS shows the matching .lang-* spans); this hook mirrors
 * it into React state and keeps every toggle in sync via a "langchange"
 * window event. Choice persists in localStorage (restored pre-paint by the
 * inline script in app/layout.tsx).
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const read = () =>
      setLangState((document.documentElement.dataset.lang as Lang) || "en");
    read();
    window.addEventListener("langchange", read);
    return () => window.removeEventListener("langchange", read);
  }, []);

  const setLang = (next: Lang) => {
    document.documentElement.dataset.lang = next;
    try {
      localStorage.setItem("lang", next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("langchange"));
  };

  return { lang, setLang, toggle: () => setLang(lang === "en" ? "uk" : "en") };
}
