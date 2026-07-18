"use client";

import { useState } from "react";
import { APPLE_MUSIC_IFRAME_ALLOW } from "@/lib/apple-music";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

/**
 * Client wrapper around an Apple Music embed iframe.
 *
 * Apple's player is a cross-origin app: its `load` event fires as soon as the
 * shell HTML arrives (~200ms), but the player sometimes stalls on its gray
 * loading skeleton afterwards while its own JS hydrates. We can't detect that
 * from outside the iframe, so instead of auto-retrying we give the reader two
 * always-available escape hatches: remount the iframe fresh ("Reload player")
 * and open the playlist directly ("Open in Apple Music"). No sandbox — see
 * APPLE_MUSIC_IFRAME_ALLOW.
 */
export default function AppleMusicEmbed({
  src,
  webUrl,
  height,
}: {
  src: string;
  webUrl: string;
  height: number;
}) {
  // Bumping the key remounts the iframe, forcing a fresh hydration attempt.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-hover)] shadow-sm transition-shadow duration-300 hover:shadow-md">
      <iframe
        key={reloadKey}
        src={src}
        height={height}
        title="Apple Music player"
        className="block w-full"
        style={{ border: 0 }}
        allow={APPLE_MUSIC_IFRAME_ALLOW}
      />
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded-md px-1.5 py-0.5 font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]"
        >
          <T {...ui.reloadPlayer} />
        </button>
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          <T {...ui.openInAppleMusic} /> ↗
        </a>
      </div>
    </div>
  );
}
