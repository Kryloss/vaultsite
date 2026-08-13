"use client";

import { useLayoutEffect } from "react";
import { siteName, siteNameUk } from "@/lib/site-config";
import {
  BEAT,
  LEAD_IN,
  SKIP_DUR,
  keyDelay,
  photoCue,
  sweepDuration,
} from "@/lib/intro";

/**
 * The first-visit intro: home types its own greeting on an empty page.
 *
 * Sequence — the photo and the body are cued by the SENTENCE, not by a stopwatch:
 *
 *   1. Nothing on screen but "Hey, I'm Kyrylo Leshchenko." appearing a
 *      character at a time behind a blinking caret.
 *   2. The moment the first name finishes, the photo fades in above it.
 *   3. A beat after the full stop, the rest of the page sweeps in line by
 *      line and the site's chrome fades up around it.
 *
 * Once per browser, ever (`localStorage`), because the third or fourth time
 * it's a toll booth. Testing it means clearing that key — see INTRO_KEY.
 *
 * THE REAL HEADING IS WHAT TYPES. There's no overlay and no second copy of the
 * text: the `<h1>` the vault wrote is split into per-character spans in place,
 * revealed one by one, and put back together as an ordinary text node at the
 * end. So the sentence never has to be duplicated in a component where it
 * would drift from `vault/Home/main.md`, nothing moves when the intro ends,
 * and the heading is the same element in the DOM throughout.
 *
 * Hidden characters keep `visibility: hidden` rather than being absent, so the
 * line is already the shape it will finish as. A typewriter that pushes its
 * own text around as it goes would reflow the page under the reader.
 *
 * WHAT MAKES THIS SAFE TO PUT IN FRONT OF THE WHOLE SITE:
 *
 * - Nothing is hidden in the HTML. Every element is visible in the served
 *   markup and only hidden by CSS keyed to `data-intro`, which JavaScript
 *   sets. No JS, or a crawler, or Reader mode: the full page, no intro.
 * - `prefers-reduced-motion` never gets it. The gate in app/layout.tsx checks
 *   before setting the attribute, so the rules never match at all.
 * - Any click, key, scroll or touch ends it immediately.
 * - The gate carries an 8s failsafe of its own, so even a driver that never
 *   loads can't leave the page blank.
 */

/**
 * localStorage key. Clear it to see the intro again — it's the only way, which
 * is the point of it.
 *
 * The same string is written into the gate script in app/layout.tsx, which
 * runs before any module is loaded and so can't import this. If it changes,
 * change it there too, or every visitor becomes a new one.
 */
export const INTRO_KEY = "intro-seen";

export default function Intro() {
  // Layout effect, not `useEffect`: on a soft navigation this is the last
  // chance to hide the page before the browser paints it. On a hard load the
  // gate script has already done it and this only finds the attribute set.
  useLayoutEffect(() => {
    const root = document.documentElement;
    let armed = root.dataset.intro === "type";

    if (!armed) {
      // Reached home by clicking rather than by loading: the gate script runs
      // on document load only, so it never saw this navigation. Somebody who
      // arrived on a post from search and then clicked home is still a first
      // visitor, and this is the path that gives them the intro.
      try {
        if (
          !localStorage.getItem(INTRO_KEY) &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          root.dataset.intro = "type";
          armed = true;
        }
      } catch {
        // Storage disabled. Nothing to do — treat it as "already seen" rather
        // than replaying the intro on every single visit.
      }
    }
    if (!armed) return;

    // Written before a single character is typed, so a reload halfway through
    // lands on the ordinary page instead of starting over.
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* nothing to remember it with; the intro just plays this once */
    }

    const lang = root.dataset.lang === "uk" ? "uk" : "en";
    const article =
      document.querySelector<HTMLElement>(`.prose.lang-${lang}`) ??
      document.querySelector<HTMLElement>(".prose");
    const heading = article?.querySelector("h1");
    const text = heading?.textContent ?? "";

    let timer = 0;
    let done = false;

    // Every way out of the intro, including simply reading on.
    const SKIP = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

    function detach() {
      window.clearTimeout(timer);
      for (const event of SKIP) window.removeEventListener(event, skip);
    }

    /**
     * Hand the page back — and that's the whole of it: two attributes.
     *
     * THE CHARACTER SPANS ARE NEVER PUT BACK, and that's the point. Every rule
     * that hides them is scoped to `html[data-intro]`, so dropping the
     * attribute reveals the heading, the caret and the page in one atomic
     * step, with no DOM surgery that could half-apply.
     *
     * Reassembling the text node would also move it. Splitting a line into one
     * inline box per character can break shaping across the boundaries — the
     * kerned pairs in "Hey," and "Kyrylo" stop being kerned — so the split
     * heading sets a hair wider than the whole one. Putting it back would let
     * the title settle by a pixel or two at exactly the moment the reader is
     * looking straight at it. Left split, the layout during the typing IS the
     * final layout and nothing ever moves. The spans cost nothing: they carry
     * no styles once the attribute is gone, `textContent` still reads the
     * sentence, and the next visit renders the ordinary heading anyway.
     */
    function teardown(lines: HTMLElement[] = []) {
      done = true;
      detach();
      root.removeAttribute("data-intro");
      root.removeAttribute("data-intro-fast");
      for (const line of lines) line.style.removeProperty("--intro-i");
    }

    function skip() {
      // Already handing the page over — a click landing during the sweep must
      // not restart it, which would flash everything back to nothing first.
      if (done || root.dataset.intro === "body") return;
      // Not `teardown()` on its own: cutting from a near-empty page to a full
      // one is the same jolt the intro exists to avoid. The reader asked for
      // the page, so it arrives at once — but it still arrives.
      root.dataset.introFast = "";
      reveal();
    }

    for (const event of SKIP) {
      window.addEventListener(event, skip, { passive: true });
    }

    // Nothing to type. A greeting the vault wrote some other way, or one
    // carrying inline markup — a link, a bold word — which `textContent` would
    // flatten and the character spans would throw away. Better to hand over
    // the real page than to perform a damaged version of it.
    if (!heading || !text || heading.children.length > 0) {
      teardown();
      return teardown;
    }

    // The spans are decoration; the heading keeps its own accessible name so
    // a screen reader announces the sentence rather than spelling it.
    heading.setAttribute("aria-label", text);
    heading.textContent = "";
    const chars = Array.from(text, (char) => {
      const span = document.createElement("span");
      span.className = "tw-c";
      span.textContent = char;
      heading.append(span);
      return span;
    });
    // An empty span for the caret to rest on after the last character, so the
    // caret is always positioned by a real box rather than measured.
    const rest = document.createElement("span");
    rest.className = "tw-c";
    heading.append(rest);
    // Only now is there anything to show. Until this class lands the heading
    // is hidden outright, which is what keeps the server's finished sentence
    // off the screen in the gap between first paint and hydration.
    heading.classList.add("tw");

    // The photo's cue: the first name, wherever it falls in the sentence.
    const photoAt = photoCue(text, lang === "uk" ? siteNameUk : siteName);

    let i = 0;
    chars[0]?.classList.add("is-next");

    function type() {
      chars[i]?.classList.remove("is-next");
      if (i >= chars.length) {
        timer = window.setTimeout(reveal, BEAT);
        return;
      }
      const char = chars[i];
      char.classList.add("is-on");
      i += 1;
      if (i === photoAt) root.dataset.intro = "photo";
      (chars[i] ?? rest).classList.add("is-next");
      timer = window.setTimeout(type, keyDelay(char.textContent ?? ""));
    }

    /** The full stop has landed — or the reader has asked. Bring in the page. */
    function reveal() {
      if (done) return;
      const fast = root.hasAttribute("data-intro-fast");
      // Stop typing and stop listening; from here the CSS finishes the job.
      detach();

      // Reading order: the rest of this article, then the page's own sections.
      // The chrome isn't in the list — it fades in as one thing, because a
      // breadcrumb and an edge zone aren't lines of a paragraph.
      const lines = [
        ...Array.from(article?.children ?? []).filter(
          (el) => el.tagName !== "H1" && !el.classList.contains("avatar")
        ),
        ...Array.from(document.querySelectorAll(".page > *:not(.prose)")),
      ] as HTMLElement[];

      // Skipping drops the stagger: it's one arrival, not a cascade.
      lines.forEach((line, n) =>
        line.style.setProperty("--intro-i", fast ? "0" : `${n}`)
      );
      root.dataset.intro = "body";

      timer = window.setTimeout(
        () => teardown(lines),
        fast ? SKIP_DUR : sweepDuration(lines.length)
      );
    }

    timer = window.setTimeout(type, LEAD_IN);
    return () => teardown();
  }, []);

  return null;
}
