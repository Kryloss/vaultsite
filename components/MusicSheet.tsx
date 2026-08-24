"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/useLang";
import { HeadphonesIcon } from "@/components/icons";
import {
  appleMusicEmbedUrl,
  appleMusicEmbedHeight,
  APPLE_MUSIC_IFRAME_ALLOW,
} from "@/lib/apple-music";

/**
 * The album player as a phone control (DECISIONS #95).
 *
 * Below 640px the note's album embed is a 450px slab dropped into the middle
 * of the writing. It becomes a square icon in the TOP-RIGHT corner instead —
 * the same 2.5rem pill as the contents icon opposite it (#51), and the same
 * headphones glyph the Music section carries in the sidebar, so the control
 * says what it opens without a label. Tapping it hangs the full player under
 * the icon.
 *
 * Only the ICON is this component's on a phone; from 640px up the inline embed
 * is the player and this renders nothing visible. Rendered by the entry page
 * for music notes that actually have an album link — a song example never gets
 * one, since it belongs to the sentence beside it (#94).
 *
 * The sheet is the ToC sheet's pattern exactly: always mounted so it can
 * animate shut, shown by `data-open`, `inert` when closed, and its contents
 * gated behind the first open — which here also means the iframe is never
 * fetched by a reader who does not tap it.
 */
export default function MusicSheet({ url }: { url: string }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [everOpen, setEverOpen] = useState(false);

  const label = lang === "uk" ? "Слухати альбом" : "Listen to the album";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEverOpen(true);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="music-pill press"
      >
        <HeadphonesIcon className="music-pill-icon" />
      </button>

      <div
        className="music-sheet-backdrop"
        data-open={open}
        aria-hidden
        onClick={() => setOpen(false)}
      />

      <div className="music-sheet" data-open={open} inert={!open}>
        {everOpen && (
          /* credentialless: fresh ephemeral storage each load — see
             DECISIONS #10 and lib/apple-music.ts. */
          <iframe
            src={appleMusicEmbedUrl(url)}
            height={appleMusicEmbedHeight(url)}
            title="Apple Music player"
            className="music-sheet-embed"
            allow={APPLE_MUSIC_IFRAME_ALLOW}
            credentialless=""
          />
        )}
      </div>
    </>
  );
}
