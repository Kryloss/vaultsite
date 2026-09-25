"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import {
  APPLE_MUSIC_IFRAME_ALLOW,
  appleMusicEmbedHeight,
  appleMusicEmbedUrl,
  isAppleMusicSong,
} from "@/lib/apple-music";
import type { MusicNote } from "@/lib/music-filter";

/**
 * Listen without leaving the deck — page idea `musicListen`
 * (lib/site-config.ts, DECISIONS #180).
 *
 * A pill floats at the foot of the window while the cover deck is on screen,
 * naming the centred record. Pressing it docks that note's own Apple Music
 * player above the pill, and the player STAYS while the deck moves on — you
 * keep listening to one record and browse the others. When the centred record
 * is a different one, the pill offers it instead, and pressing swaps the
 * player over.
 *
 * It floats rather than sitting in the deck's caption because nothing on that
 * page may change height (docs/MUSIC.md); a fixed layer costs the page none.
 * The player is the same iframe the note page embeds — same crop, same theme,
 * same `credentialless` — so it looks and behaves the way it does there.
 */
export default function ListenDock({ note }: { note?: MusicNote }) {
  const [playing, setPlaying] = useState<MusicNote | null>(null);
  const [deckInView, setDeckInView] = useState(false);

  useEffect(() => {
    const deck = document.querySelector(".coverflow");
    if (!deck) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDeckInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(deck);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const offer = note?.listen && note.slug !== playing?.slug && deckInView ? note : null;
  if (!playing && !offer) return null;

  return (
    <div className="idea-listen">
      {playing?.listen && (
        <div className="idea-listen-player" role="region" aria-label={playing.title}>
          <div className="idea-listen-head">
            <span className="idea-listen-now">
              <T en={playing.title} uk={playing.titleUk} />
            </span>
            <button
              type="button"
              className="idea-listen-close press"
              onClick={() => setPlaying(null)}
            >
              <span aria-hidden>×</span>
              <span className="sr-only">
                <T {...ui.closePlayer} />
              </span>
            </button>
          </div>
          <div
            className="apple-music-block"
            data-kind={isAppleMusicSong(playing.listen) ? "song" : "album"}
          >
            <iframe
              key={playing.slug}
              className="apple-music-embed"
              title="Apple Music player"
              allow={APPLE_MUSIC_IFRAME_ALLOW}
              height={appleMusicEmbedHeight(playing.listen)}
              src={appleMusicEmbedUrl(playing.listen)}
              {...{ credentialless: "" }}
            />
          </div>
        </div>
      )}

      {offer && (
        <button
          type="button"
          className="idea-listen-pill press"
          onClick={() => setPlaying(offer)}
        >
          {offer.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.cover} srcSet={offer.coverSrcSet} sizes="28px" alt="" className="idea-listen-cover" />
          )}
          <span className="idea-listen-label">
            <T {...ui.musicListen} />
          </span>
          <span className="idea-listen-title">
            <T en={offer.title} uk={offer.titleUk} />
          </span>
        </button>
      )}
    </div>
  );
}
