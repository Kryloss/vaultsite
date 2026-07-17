"use client";

import { useState } from "react";

/**
 * Renders a truncated preview with a "Continue reading" toggle that swaps in
 * the full HTML in place. Both versions are pre-rendered at build time —
 * no client-side markdown work.
 */
export default function ExpandableHtml({
  preview,
  full,
}: {
  preview: string;
  full: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return <div className="prose mt-3" dangerouslySetInnerHTML={{ __html: full }} />;
  }

  return (
    <>
      <div className="prose prose-faded mt-3" dangerouslySetInnerHTML={{ __html: preview }} />
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-2 text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-75"
      >
        Continue reading →
      </button>
    </>
  );
}
