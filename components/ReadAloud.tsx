"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui-strings";
import { factSentence, isSourcesHeading, pickVoice } from "@/lib/read-aloud";

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
 * DECISIONS #180, #181), on every note: posts, people, music, shelf,
 * projects. The browser's own speech (Web Speech API), so nothing is fetched
 * and nothing leaves the page; in Ukrainian when the page is showing
 * Ukrainian, with the best voice the system has for it (lib/read-aloud.ts →
 * pickVoice — a neural or enhanced voice over the compact default).
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
export default function ReadAloud({ separated = true }: { separated?: boolean }) {
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

  const start = async () => {
    const uk = document.documentElement.dataset.lang === "uk";
    const steps = readingScript(uk);
    if (steps.length === 0) return;
    const id = ++run.current;
    setState("playing");
    const voice = pickVoice(await voices(), uk ? "uk" : "en", navigator.language);
    if (id !== run.current) return;
    window.speechSynthesis.cancel();

    const speak = (i: number) => {
      if (id !== run.current) return;
      if (i >= steps.length) {
        stop();
        return;
      }
      const u = new SpeechSynthesisUtterance(steps[i].text);
      u.lang = voice?.lang ?? (uk ? "uk-UA" : "en-US");
      if (voice) u.voice = voice;
      u.onstart = () => mark(steps[i].el);
      u.onend = () => speak(i + 1);
      u.onerror = () => {
        if (id === run.current) stop();
      };
      window.speechSynthesis.speak(u);
    };
    speak(0);
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
      {separated && <span aria-hidden>·</span>}
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
