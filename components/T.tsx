import type { ReactNode } from "react";

/**
 * Bilingual text: renders BOTH languages into the static HTML; CSS shows the
 * active one based on the `data-lang` attribute on <html> (set by the sidebar
 * toggle, persisted in localStorage, restored pre-paint by an inline script
 * in app/layout.tsx). Works in server and client components — no hydration,
 * no routing, no double builds.
 *
 * English is the primary language: when no Ukrainian text is provided,
 * English renders for both.
 *
 * The Ukrainian span carries `lang="uk"`. <html lang> stays "en" — it's the
 * document's primary language and the canonical URL's — so without this a
 * screen reader announces Cyrillic with an English voice, and a translation
 * tool treats the page as monolingual. It's one attribute and it's the whole
 * fix; the English span needs none, since it already inherits from <html>.
 */
export default function T({ en, uk }: { en: ReactNode; uk?: ReactNode }) {
  if (uk == null || uk === en) return <>{en}</>;
  return (
    <>
      <span className="lang-en">{en}</span>
      <span className="lang-uk" lang="uk">
        {uk}
      </span>
    </>
  );
}
