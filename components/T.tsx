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
 */
export default function T({ en, uk }: { en: ReactNode; uk?: ReactNode }) {
  if (uk == null || uk === en) return <>{en}</>;
  return (
    <>
      <span className="lang-en">{en}</span>
      <span className="lang-uk">{uk}</span>
    </>
  );
}
