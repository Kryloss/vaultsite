"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import T from "@/components/T";
import { useLang } from "@/components/useLang";
import { ui } from "@/lib/ui-strings";
import { vibeDay, vibeEmbedUrl, vibeTime, type TodaysVibe as Vibe } from "@/lib/todays-vibe";
import { youtubeCover, youtubeWatchUrl } from "@/lib/youtube";

const STORAGE_KEY = "todays-vibe-hidden";
const CHANGE = "vibevisibility";
const OPEN = "vibeopen";
let memoryHidden: boolean | null = null;
function snapshot() {
  let hidden = false;
  try { hidden = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* Optional storage. */ }
  return `${(memoryHidden ?? hidden) ? "hidden" : "visible"}:${vibeDay(new Date())}`;
}
function subscribe(callback: () => void) {
  const onStorage = () => { memoryHidden = null; callback(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, callback);
  document.addEventListener("visibilitychange", callback);
  const timer = window.setInterval(callback, 60_000);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, callback);
    document.removeEventListener("visibilitychange", callback);
    window.clearInterval(timer);
  };
}
const serverSnapshot = () => "";
function setHidden(hidden: boolean) {
  memoryHidden = hidden;
  try { localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0"); } catch { /* Remember for this visit. */ }
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * The slice of YouTube's IFrame Player API the capsule uses. Typed here rather
 * than pulled in as a package: five calls and three events is the whole of it.
 * https://developers.google.com/youtube/iframe_api_reference
 */
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}
interface YouTubeApi {
  Player: new (frame: HTMLIFrameElement, options: {
    events: {
      onReady?: () => void;
      onAutoplayBlocked?: () => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
/** onStateChange codes worth naming; the rest (unstarted, cued) change nothing. */
const ENDED = 0, PLAYING = 1, BUFFERING = 3;
/** onError codes for "this upload may not be embedded" — retrying never helps. */
const NOT_EMBEDDABLE = new Set([101, 150]);

let apiPromise: Promise<YouTubeApi> | null = null;
/**
 * Fetch YouTube's player script once, on the first press. Nothing of YouTube's
 * is requested before that — the same bargain the nocookie host is here for.
 */
function loadPlayerApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => fail(), 15000);
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      apiPromise = null;
      reject(new Error("YouTube player API unavailable"));
    };
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return apiPromise;
}

function NoteIcon() {
  return <svg className="vibe-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l11-2v13M9 9l11-2" />
    <ellipse cx="6" cy="18" rx="3" ry="2.5" fill="currentColor" stroke="none" />
    <ellipse cx="17" cy="16" rx="3" ry="2.5" fill="currentColor" stroke="none" />
  </svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>;
}
function PauseIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
}

/**
 * The way back to hidden music: a note INSIDE the breadcrumb chip, between the
 * menu button and the crumbs (mounted by Chrome.tsx). It wears that button's
 * classes, not the capsule's — a control on the chip hovers by colour, never by
 * a filled background, or a translucent pill ends up with a solid square in it.
 * Being in the other tree, it hands focus back over an event.
 */
export function TodaysVibeRestore({ track }: { track: Vibe }) {
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const { lang } = useLang();
  if (!saved.startsWith("hidden:")) return null;
  const name = `${ui.showVibe[lang]}: ${track.title} · ${track.artist}`;
  return <button type="button" aria-label={name} title={name}
    className="vibe-restore press flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text)]"
    onClick={() => { setHidden(false); window.dispatchEvent(new Event(OPEN)); }}>
    <NoteIcon />
  </button>;
}

export default function TodaysVibe({ track }: { track: Vibe }) {
  const { lang } = useLang();
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const hidden = saved.startsWith("hidden:");
  /** Empty until the first press: the player is what the press builds. */
  const [source, setSource] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** A press is waiting to become sound; cleared only when it does. */
  const [awaiting, setAwaiting] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState<"retry" | "blocked" | "autoplay" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  /** A cover that 404s or is blocked falls back to the note, never a gap. */
  const [coverFailed, setCoverFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  /** Commands are safe only after YouTube signals readiness. */
  const ready = useRef(false);
  const wantsPlayback = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = saved && saved.split(":")[1] !== track.date ? ui.latestVibe : ui.todaysVibe;
  const loading = awaiting || buffering;

  function togglePlayback() {
    if (!track.video) return;
    wantsPlayback.current = !playing;
    if (!source || (failed && failed !== "autoplay")) {
      ready.current = false;
      player.current = null;
      setPlaying(false);
      setElapsed(0);
      setDuration(0);
      setBuffering(false);
      setFailed(null);
      setAttempt(value => value + 1);
      setSource(vibeEmbedUrl(track.video, location.origin));
      setAwaiting(true);
      return;
    }
    setFailed(null);
    if (playing) { player.current?.pauseVideo(); setAwaiting(false); }
    else {
      setAwaiting(true);
      if (ready.current) player.current?.playVideo();
    }
  }

  function visibility(next: boolean) {
    wantsPlayback.current = false;
    if (ready.current) player.current?.pauseVideo();
    setAwaiting(false);
    setHidden(next);
    // The note that takes over lives in the chip, in another tree — so it is
    // found rather than held in a ref.
    requestAnimationFrame(() => next
      ? document.querySelector<HTMLButtonElement>(".vibe-restore")?.focus()
      : trigger.current?.focus());
  }

  // A retry mounts a fresh iframe. React owns its removal; callbacks from an
  // old attempt are ignored, including a late ready event after hiding.
  useEffect(() => {
    const element = frame.current;
    if (!source || !element) return;
    let live = true;
    const stateChanged = (state: number) => {
      if (!live) return;
      setBuffering(state === BUFFERING);
      setPlaying(state === PLAYING);
      if (state === PLAYING) {
        setAwaiting(false);
        setFailed(null);
        if (!wantsPlayback.current) player.current?.pauseVideo();
      }
      if (state === ENDED) setElapsed(0);
    };
    loadPlayerApi().then(api => {
      if (!live) return;
      player.current = new api.Player(element, {
        events: {
          onReady: () => {
            if (!live) return;
            ready.current = true;
            const active = player.current!;
            // Autoplay can precede API attachment: reconcile instead of
            // incorrectly reporting a timeout for an already playing track.
            stateChanged(active.getPlayerState());
            if (wantsPlayback.current) active.playVideo();
            else active.pauseVideo();
          },
          onStateChange: event => stateChanged(event.data),
          onAutoplayBlocked: () => {
            if (!live || !wantsPlayback.current) return;
            setAwaiting(false);
            setBuffering(false);
            setFailed("autoplay");
          },
          onError: event => {
            if (!live) return;
            setPlaying(false);
            setBuffering(false);
            setAwaiting(false);
            setFailed(NOT_EMBEDDABLE.has(event.data) ? "blocked" : "retry");
          },
        },
      });
    }).catch(() => { if (live) { setAwaiting(false); setFailed("retry"); } });
    return () => { live = false; };
  }, [source, attempt]);

  useEffect(() => {
    if (!awaiting || hidden) return;
    const timer = window.setTimeout(() => {
      setAwaiting(false);
      setBuffering(false);
      setFailed("retry");
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [awaiting, hidden, attempt]);

  // The API has no time event of its own, so the position is read while it runs.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const active = player.current;
      if (!active || !ready.current) return;
      setElapsed(active.getCurrentTime());
      const total = active.getDuration();
      if (Number.isFinite(total) && total > 0) setDuration(total);
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (hidden) {
      wantsPlayback.current = false;
      if (ready.current) player.current?.pauseVideo();
    }
  }, [hidden]);
  // Restored from the chip's note: take the keyboard back, without starting sound.
  useEffect(() => {
    const onOpen = () => requestAnimationFrame(() => trigger.current?.focus());
    window.addEventListener(OPEN, onOpen);
    return () => window.removeEventListener(OPEN, onOpen);
  }, []);

  const action = !track.video ? ui.vibeUnavailable : playing ? ui.pauseVibe : ui.listenVibe;
  return (
    <div className="vibe" data-ready={Boolean(saved)} data-playing={playing} data-hidden={hidden}>
      {/* YouTube plays; the capsule is the interface. The frame is parked out of
          sight rather than removed, hidden or shrunk to nothing: a display:none
          or zero-sized player gets its playback suspended. `inert` keeps it off
          the tab order and out of the accessibility tree. */}
      {source && <iframe key={attempt} ref={frame} className="vibe-frame" src={source} inert tabIndex={-1}
        title={`${track.title} — ${track.artist}`} allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin" />}
      <div className="vibe-capsule chrome-bar" hidden={hidden}>
        <button ref={trigger} type="button" className="vibe-trigger press"
          onClick={togglePlayback} disabled={!track.video}
          /* “Today’s vibe” left the capsule — the owner asked for the track
             alone. The label still has to be said somewhere, because a pick
             from an older Toronto date reads “Latest vibe” and that is the
             whole point of the distinction (#162), so it moves in here. */
          aria-label={`${label[lang]}: ${track.title} · ${track.artist} · ${action[lang]}`} aria-pressed={playing}
          title={`${label[lang]} (${track.date}) · ${track.title} — ${track.artist} · ${action[lang]}`}>
          <span className="vibe-symbol" data-loading={loading}>
            {/* The track's own artwork, which is what a player shows. The note
                stays as the fallback for a pick with no video and for a cover
                that fails to load. Decorative: the button is already named. */}
            {track.video && !coverFailed
              ? <img className="vibe-cover" src={youtubeCover(track.video)} alt=""
                  decoding="async" onError={() => setCoverFailed(true)} />
              : <NoteIcon />}
            <span className="vibe-glyph" aria-hidden="true">{playing ? <PauseIcon /> : <PlayIcon />}</span>
          </span>
          <span className="vibe-title">{track.title}</span>
        </button>
        <button type="button" className="vibe-hide press" onClick={() => visibility(true)}
          aria-label={ui.hideVibe[lang]} title={ui.hideVibe[lang]}>×</button>
        {duration > 0 && <input className="vibe-seek" type="range" min={0} max={duration} step={1}
          /* The played part of the track is painted from here: a range input
             has no progress of its own, and the alternative is a second
             element sitting under a transparent slider. */
          style={{ "--vibe-progress": `${Math.min(elapsed, duration) / duration * 100}%` } as CSSProperties}
          value={Math.min(elapsed, duration)} aria-label={ui.seekVibe[lang]}
          aria-valuetext={`${vibeTime(elapsed)} / ${vibeTime(duration)}`}
          onChange={event => {
            const value = Number(event.currentTarget.value);
            if (ready.current) player.current?.seekTo(value, true);
            setElapsed(value);
          }} />}
      </div>
      {failed && !hidden && <p className="vibe-error" role="status">
        <T {...(failed === "blocked" ? ui.vibeBlocked : failed === "autoplay" ? ui.vibeAutoplay : ui.vibeFailed)} />
        {/* However it failed, the track itself is still one link away. */}
        {track.video && <>
          {" "}
          <a href={youtubeWatchUrl(track.video)} target="_blank" rel="noopener noreferrer"><T {...ui.vibeOnYouTube} /></a>
        </>}
      </p>}
    </div>
  );
}
