"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { useLang } from "@/components/useLang";
import { CloseIcon, PauseIcon, PlayIcon } from "@/components/icons";
import {
  factSentence,
  isSourcesHeading,
  pickVoice,
  progressAt,
  stepAfterSwitch,
  stepAtFraction,
  stepOffsets,
} from "@/lib/read-aloud";

type State = "idle" | "playing" | "paused";

const subscribe = () => () => {};

interface Step {
  /** What is marked while it is read. */
  el: HTMLElement;
  text: string;
}

const visible = (el: Element | null): el is HTMLElement =>
  !!el && (el as HTMLElement).offsetParent !== null;

/**
 * An element's words in the language being read. Chrome and metadata that
 * sit inside a block are not part of the sentence: the heading anchor's "#",
 * footnote markers, the Draft/New chips, the copy button, nested lists (read
 * as their own items). A rating's stars are read by their accessible name.
 */
function spoken(el: HTMLElement, uk: boolean): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("svg[role='img'][aria-label]").forEach((svg) =>
    svg.replaceWith(document.createTextNode(` ${svg.getAttribute("aria-label")} `))
  );
  copy
    .querySelectorAll(
      `${uk ? ".lang-en" : ".lang-uk"}, sup, .heading-anchor, .draft-chip, .new-chip, .cover-new, button, [aria-hidden='true'], ul, ol`
    )
    .forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * What "Listen" reads, in order (DECISIONS #181):
 *
 * 1. the note's title;
 * 2. on a shelf or music note, the creator block — role, name, biography;
 * 3. the "At a glance" facts, a row at a time ("Born: March 9, 1985."),
 *    from whichever copy is on screen — the article's, or the contents
 *    rail's on a wide People page;
 * 4. the body, block by block, skipping code, figures, footnotes and margin
 *    notes, the orphaned "At a glance" heading the facts were lifted from,
 *    and stopping at Sources — a list of links is for reading, not listening.
 */
function readingScript(uk: boolean): Step[] {
  const steps: Step[] = [];
  const add = (el: HTMLElement | null, text?: string) => {
    if (!el) return;
    const t = (text ?? spoken(el, uk)).trim();
    if (t) steps.push({ el, text: t });
  };

  add(document.querySelector<HTMLElement>("h1.page-title"));

  const creator = document.querySelector<HTMLElement>(".creator");
  if (visible(creator)) {
    const part = (sel: string) => {
      const el = creator.querySelector<HTMLElement>(sel);
      return el ? spoken(el, uk) : "";
    };
    const role = part(".creator-role");
    const name = part(".creator-name");
    const bio = part(".creator-bio");
    add(creator, [role && name ? `${role}: ${name}.` : name, bio].filter(Boolean).join(" "));
  }

  const facts = [...document.querySelectorAll(".note-facts, .toc-facts")].find(visible);
  for (const row of facts?.querySelectorAll<HTMLElement>("tbody tr") ?? []) {
    const [label, value] = [...row.querySelectorAll<HTMLElement>("td")].map((td) => spoken(td, uk));
    if (label && value) add(row, factSentence(label, value));
  }

  const body = [...document.querySelectorAll<HTMLElement>(".prose.mt-8:not(.note-facts)")].find(visible);
  for (const el of body?.querySelectorAll<HTMLElement>("h2, h3, h4, p, li") ?? []) {
    if (el.closest("pre, figure, figcaption, table, .footnotes, [data-footnotes], aside, .sidenote")) continue;
    if (el.tagName === "P" && el.closest("li")) continue;
    if (el.classList.contains("fact-heading")) continue;
    if (/^H[234]$/.test(el.tagName) && isSourcesHeading(spoken(el, uk))) break;
    add(el);
  }
  return steps;
}

/**
 * The voices, once the browser has them. Chrome fills the list
 * asynchronously and answers an empty array the first time it is asked, so
 * this waits for `voiceschanged` — briefly: a system with no voices at all
 * never fires it, and speech with the default voice beats no speech.
 */
function voices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 800);
  });
}

/**
 * Read the note aloud — page idea `noteReadAloud` (lib/site-config.ts,
 * DECISIONS #180, #181, #182), on every note: posts, people, music, shelf,
 * projects. The browser's own speech (Web Speech API), so nothing is fetched
 * and nothing leaves the page; in the language the page is showing, with the
 * best voice the system has for it (lib/read-aloud.ts → pickVoice).
 *
 * "Listen" in the metadata line starts it and then steps aside until the
 * player is closed. The player floats at the foot of the window: play/pause,
 * the note's title, close, and under them a bar that is both where the voice
 * is and a way to move it (dragging or arrow keys seek to the block at that
 * point). While it is open:
 *
 * - every block it will read can be pressed to move the voice there — except
 *   on a link or a control, and not when the press ended a text selection;
 * - switching language carries on in the other language from the NEXT block
 *   (the one being read has been heard; lib/read-aloud.ts → stepAfterSwitch).
 *
 * Pause is the engine's own pause, so a paragraph resumes mid-sentence. Any
 * MOVE while paused — a press on a block, a seek, a language switch — cancels
 * the engine instead and remembers where to begin, because a paused engine
 * holding a queued utterance resumes that utterance, not the new place.
 */
export default function ReadAloud({ separated = true }: { separated?: boolean }) {
  const supported = useSyncExternalStore(
    subscribe,
    () => "speechSynthesis" in window,
    () => false
  );
  const { lang } = useLang();
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  /** Bumped whenever the script is rebuilt, so the press targets follow it. */
  const [version, setVersion] = useState(0);

  const run = useRef(0);
  const current = useRef<HTMLElement | null>(null);
  const steps = useRef<Step[]>([]);
  const offsets = useRef(stepOffsets([]));
  const pos = useRef(0);
  /** Paused, but the engine was cancelled — resume means "speak from pos". */
  const pending = useRef(false);
  const uk = useRef(false);
  const voiceList = useRef<SpeechSynthesisVoice[]>([]);
  /** The state as the async start and the language observer see it. */
  const stateRef = useRef<State>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const mark = (el: HTMLElement | null) => {
    current.current?.classList.remove("idea-speaking");
    current.current = el;
    if (!el) return;
    el.classList.add("idea-speaking");
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 120) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  };

  const build = useCallback((inUk: boolean) => {
    uk.current = inUk;
    steps.current = readingScript(inUk);
    offsets.current = stepOffsets(steps.current.map((s) => s.text.length));
    setTitle(steps.current[0]?.text ?? document.title);
    setVersion((v) => v + 1);
  }, []);

  const stop = useCallback(() => {
    run.current++;
    window.speechSynthesis?.cancel();
    current.current?.classList.remove("idea-speaking");
    current.current = null;
    pending.current = false;
    pos.current = 0;
    setProgress(0);
    setState("idle");
  }, []);

  useEffect(() => stop, [stop]);

  /** Speak from step `from` to the end, as one run that a newer run cancels. */
  const speakFrom = useCallback(
    (from: number) => {
      const id = ++run.current;
      window.speechSynthesis.cancel();
      pending.current = false;
      const voice = pickVoice(voiceList.current, uk.current ? "uk" : "en", navigator.language);
      const speak = (i: number) => {
        if (id !== run.current) return;
        const step = steps.current[i];
        if (!step) {
          stop();
          return;
        }
        const u = new SpeechSynthesisUtterance(step.text);
        u.lang = voice?.lang ?? (uk.current ? "uk-UA" : "en-US");
        if (voice) u.voice = voice;
        u.onstart = () => {
          if (id !== run.current) return;
          pos.current = i;
          mark(step.el);
          setProgress(progressAt(offsets.current, i));
        };
        u.onboundary = (e) => {
          if (id === run.current) setProgress(progressAt(offsets.current, i, e.charIndex));
        };
        u.onend = () => speak(i + 1);
        u.onerror = (e) => {
          // A cancel from a newer run reports "interrupted"/"canceled" here.
          if (id === run.current && e.error !== "interrupted" && e.error !== "canceled") stop();
        };
        window.speechSynthesis.speak(u);
      };
      speak(from);
      setState("playing");
    },
    [stop]
  );

  /** Move the voice to step `i`: at once if playing, on resume if paused. */
  const moveTo = useCallback(
    (i: number, play: boolean) => {
      const step = steps.current[i];
      if (!step) return;
      pos.current = i;
      mark(step.el);
      setProgress(progressAt(offsets.current, i));
      if (play) {
        speakFrom(i);
      } else {
        run.current++;
        window.speechSynthesis.cancel();
        pending.current = true;
      }
    },
    [speakFrom]
  );

  const start = async () => {
    build(document.documentElement.dataset.lang === "uk");
    if (steps.current.length === 0) return;
    setState("playing");
    // Closed while the voices were arriving? `stop` bumps the run.
    const id = ++run.current;
    voiceList.current = await voices();
    if (id !== run.current) return;
    speakFrom(0);
  };

  const toggle = () => {
    if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused");
    } else if (pending.current) {
      speakFrom(pos.current);
    } else {
      window.speechSynthesis.resume();
      setState("playing");
    }
  };

  /* Language switched while open: rebuild in the new language and carry on
     from the next block. <html data-lang> is the toggle's single source. */
  useEffect(() => {
    if (state === "idle") return;
    const observer = new MutationObserver(() => {
      const nowUk = document.documentElement.dataset.lang === "uk";
      if (nowUk === uk.current) return;
      const next = stepAfterSwitch(pos.current, readingScript(nowUk).length);
      build(nowUk);
      if (next === null) {
        stop();
        return;
      }
      moveTo(next, stateRef.current === "playing");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, [state, build, moveTo, stop]);

  /* Press a block to move the voice there. The blocks are marked as targets
     only while the player is open, and a press on a link or a control inside
     one keeps its own meaning. */
  useEffect(() => {
    if (state === "idle") return;
    const els = steps.current.map((s) => s.el);
    els.forEach((el) => el.classList.add("idea-read-step"));
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest("a, button, input, textarea, select, summary, label, iframe")) return;
      if ((window.getSelection()?.toString() ?? "").trim()) return;
      const i = els.findIndex((el) => el.contains(target));
      if (i === -1) return;
      moveTo(i, true);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      els.forEach((el) => el.classList.remove("idea-read-step"));
    };
  }, [state, version, moveTo]);

  if (!supported) return null;

  if (state === "idle") {
    return (
      <>
        {separated && <span aria-hidden>·</span>}
        <button type="button" onClick={start} className="idea-read-aloud press">
          {/* The second icon on page content, at the owner's request (#182):
              it says "this plays" before the word is read. */}
          <PlayIcon className="idea-read-aloud-icon" />
          <T {...ui.readAloud} />
        </button>
      </>
    );
  }

  const playing = state === "playing";
  return (
    <div className="idea-read-player" role="region" aria-label={ui.readAloudPlayer[lang]}>
      <div className="idea-read-row">
        <button
          type="button"
          onClick={toggle}
          className="idea-read-play press"
          aria-label={(playing ? ui.readAloudPause : ui.readAloudPlay)[lang]}
        >
          {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-px" />}
        </button>
        <span className="idea-read-title" title={title}>
          {title}
        </span>
        <button
          type="button"
          onClick={stop}
          className="idea-read-close press"
          aria-label={ui.readAloudClose[lang]}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(progress * 1000)}
        onChange={(e) => {
          const i = stepAtFraction(offsets.current, Number(e.target.value) / 1000);
          if (i !== pos.current || !playing) moveTo(i, playing);
        }}
        aria-label={ui.readAloudSeek[lang]}
        aria-valuetext={`${Math.round(progress * 100)}%`}
        className="idea-read-bar"
        style={{ "--p": `${progress * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}
