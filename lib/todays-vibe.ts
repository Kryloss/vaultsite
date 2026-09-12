/** Build-time frontmatter contract. No vault or filesystem imports here. */
import { youtubeEmbedUrl, youtubeId } from "@/lib/youtube";

export interface TodaysVibe {
  title: string;
  artist: string;
  date: string;
  /** The 11-character YouTube ID the capsule plays, when one is set. */
  video?: string;
}

/**
 * A YouTube video, given either as any link YouTube hands out or as the bare
 * ID — pasting the ID alone is easy to do by hand and unambiguous at 11
 * characters. Nothing else is accepted, so a stray note or a playlist URL
 * leaves the pick visible without pretending it can play.
 */
export function vibeVideoId(value: string): string | undefined {
  const source = value.trim();
  if (!source) return undefined;
  return youtubeId(source) ?? (/^[A-Za-z0-9_-]{11}$/.test(source) ? source : undefined);
}

/**
 * The capsule's player URL. The capsule is the interface, so every piece of
 * YouTube's own is switched off: no control bar (`controls`), no keyboard
 * handling of its own (`disablekb`), no fullscreen button (`fs`), no end-card
 * grid (`rel`), no annotations (`iv_load_policy`), and inline playback on
 * phones (`playsinline`) so iOS doesn't take over the screen.
 *
 * The global capsule primes its frame with autoplay off so the API is ready
 * before the visitor presses its own play button. `enablejsapi` is what lets
 * play, pause and seek reach it.
 */
export function vibeEmbedUrl(id: string, origin?: string, autoplay = true): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    autoplay: autoplay ? "1" : "0",
    controls: "0",
    disablekb: "1",
    fs: "0",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    playsinline: "1",
  });
  if (origin) params.set("origin", origin);
  return `${youtubeEmbedUrl(id)}?${params}`;
}

export function parseTodaysVibe(meta: Record<string, unknown>): TodaysVibe | null {
  const text = (key: string) => typeof meta[key] === "string" ? meta[key].trim() : "";
  const title = text("vibe_title");
  const artist = text("vibe_artist");
  const date = text("vibe_date");
  if (!title || !artist || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(+parsedDate) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  return { title, artist, date, video: vibeVideoId(text("vibe_youtube")) };
}

export function vibeDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function vibeTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
