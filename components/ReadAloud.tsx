"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";

type State = "idle" | "playing" | "paused";

const subscribe = () => () => {};

/** Blocks worth reading aloud, in order — not code, captions, footnotes or notes in the margin. */
function readableBlocks(): HTMLElement[] {
  const bodies = [...document.querySelectorAll<HTMLElement>(".prose.mt-8:not(.note-facts)")];
  const body = bodies.find((el) => el.offsetParent !== null);
  if (!body) return [];
  return [...body.querySelectorAll<HTMLElement>("h2, h3, h4, p, li")].filter(
    (el) =>
      !el.closest("pre, figure, figcaption, table, .footnotes, [data-footnotes], aside, .sidenote") &&
      !(el.tagName === "P" && el.closest("li")) &&
      (el.textContent ?? "").trim().length > 0
  );
}

/** The heading anchor's "#" and footnote markers are not part of the sentence. */
function spoken(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("sup, .heading-anchor, [aria-hidden='true'], ul, ol").forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Read the note aloud — page idea `noteReadAloud` (lib/site-config.ts,
 * DECISIONS #180). The browser's own speech (Web Speech API), so nothing is
 * fetched and nothing leaves the page; in Ukrainian when the page is showing
 * Ukrainian, with a Ukrainian voice when the system has one.
 *
 * It reads one block at a time and marks the block it is on, bringing it into
 * view only when it has left the window — the reader follows the voice, and a
 * reader who scrolls away to look at something is not dragged back until the
 * next paragraph starts. Per-block utterances are also what keeps Chromium
 * from silently stopping a long one mid-sentence.
 *
 * Hidden until mounted and only where speech exists, like every other
 * reader-side control. A pill at the foot of the window keeps Pause and Stop
 * in reach once the "Listen" in the metadata line has scrolled away.
 */
export default function ReadAloud() {
  const supported = useSyncExternalStore(
    subscribe,
    () => "speechSynthesis" in window,
    () => false
  );
  const [state, setState] = useState<State>("idle");
  const run = useRef(0);
  const current = useRef<HTMLElement | null>(null);

  const mark = (el: HTMLElement | null) => {
    current.current?.classList.remove("idea-speaking");
    current.current = el;
    if (!el) return;
    el.classList.add("idea-speaking");
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  };

  const stop = useCallback(() => {
    run.current++;
    window.speechSynthesis?.cancel();
    current.current?.classList.remove("idea-speaking");
    current.current = null;
    setState("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    const blocks = readableBlocks();
    if (blocks.length === 0) return;
    const id = ++run.current;
    const uk = document.documentElement.dataset.lang === "uk";
    const langCode = uk ? "uk-UA" : "en-US";
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(uk ? "uk" : "en"));
    window.speechSynthesis.cancel();

    const speak = (i: number) => {
      if (id !== run.current) return;
      if (i >= blocks.length) {
        stop();
        return;
      }
      const u = new SpeechSynthesisUtterance(spoken(blocks[i]));
      u.lang = langCode;
      if (voice) u.voice = voice;
      u.onstart = () => mark(blocks[i]);
      u.onend = () => speak(i + 1);
      u.onerror = () => {
        if (id === run.current) stop();
      };
      window.speechSynthesis.speak(u);
    };
    speak(0);
    setState("playing");
  };

  const toggle = () => {
    if (state === "idle") start();
    else if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused");
    } else {
      window.speechSynthesis.resume();
      setState("playing");
    }
  };

  if (!supported) return null;

  const label =
    state === "idle" ? ui.readAloud : state === "playing" ? ui.readAloudPause : ui.readAloudResume;

  return (
    <>
      <span aria-hidden>·</span>
      <button type="button" onClick={toggle} className="idea-read-aloud press">
        <T {...label} />
      </button>
      {state !== "idle" && (
        <div className="idea-read-pill" role="status">
          <span className="idea-read-pill-dot" data-paused={state === "paused" ? "" : undefined} aria-hidden />
          <span className="idea-read-pill-label">
            <T {...ui.readingAloud} />
          </span>
          <button type="button" onClick={toggle} className="idea-read-pill-btn press">
            <T {...(state === "playing" ? ui.readAloudPause : ui.readAloudResume)} />
          </button>
          <button type="button" onClick={stop} className="idea-read-pill-btn press">
            <T {...ui.readAloudStop} />
          </button>
        </div>
      )}
    </>
  );
}
