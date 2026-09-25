/**
 * The pure half of "Listen" (components/ReadAloud.tsx, page idea
 * `noteReadAloud`, DECISIONS #180, #181): which voice to use, how a fact row
 * is said, and where a note stops being worth reading aloud.
 */

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * Names the platforms give their better voices. Edge's "Online (Natural)"
 * neural voices, Apple's "Premium"/"Enhanced" downloads and Siri, and
 * Chrome's network "Google" voices are all a clear step above the default
 * compact voice most systems hand back first.
 */
const QUALITY: [RegExp, number][] = [
  [/\bnatural\b|\bneural\b/i, 50],
  [/\bpremium\b/i, 40],
  [/\benhanced\b/i, 30],
  [/\bsiri\b/i, 25],
  [/^google\b/i, 20],
];

/** Novelty voices macOS ships alongside the real ones — never the right pick. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

/**
 * The best voice for a language ("en" or "uk"): the reader's own region
 * first when it matches (an en-CA reader gets en-CA), then the quality
 * markers above, then the system default. Undefined when the system has no
 * voice in that language at all — the utterance's `lang` still asks the
 * browser to try.
 */
export function pickVoice<V extends VoiceLike>(
  voices: V[],
  language: "en" | "uk",
  preferredLocale?: string
): V | undefined {
  const score = (v: V): number => {
    let s = 0;
    for (const [re, points] of QUALITY) if (re.test(v.name)) s = Math.max(s, points);
    if (preferredLocale && v.lang.toLowerCase() === preferredLocale.toLowerCase()) s += 10;
    if (language === "en" && /^en-(us|gb|ca)$/i.test(v.lang)) s += 3;
    if (v.default) s += 1;
    return s;
  };
  return voices
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(language) && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a))[0];
}

/** A fact row as a sentence: "Born: March 9, 1985." — no doubled full stop. */
export function factSentence(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `${label.trim()}: ${v}${/[.!?…]$/.test(v) ? "" : "."}`;
}

/** The Sources heading — a list of links is for reading, not for listening. */
export function isSourcesHeading(text: string): boolean {
  return /^(sources|джерела|references|посилання)$/i.test(text.replace(/#\s*$/, "").trim());
}

/**
 * Where each step starts, counted in characters, plus the total — so the
 * playback bar moves with the text, not with the number of paragraphs (a
 * title and a long paragraph are not the same distance).
 */
export function stepOffsets(lengths: number[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let total = 0;
  for (const n of lengths) {
    starts.push(total);
    total += Math.max(n, 1);
  }
  return { starts, total };
}

/** 0–1 through the note: step `i`, `charIndex` characters into it. */
export function progressAt(
  offsets: { starts: number[]; total: number },
  i: number,
  charIndex = 0
): number {
  if (offsets.total === 0 || i < 0) return 0;
  if (i >= offsets.starts.length) return 1;
  return Math.min(1, (offsets.starts[i] + Math.max(0, charIndex)) / offsets.total);
}

/** The step a seek to `fraction` (0–1) of the note lands in. */
export function stepAtFraction(offsets: { starts: number[]; total: number }, fraction: number): number {
  const target = Math.max(0, Math.min(1, fraction)) * offsets.total;
  let i = 0;
  while (i + 1 < offsets.starts.length && offsets.starts[i + 1] <= target) i++;
  return i;
}

/**
 * The language changed mid-note: carry on in the other language from the
 * NEXT block — the one being read has been heard, in one language or the
 * other, and restarting it would say it twice. The two readings share their
 * shape (title, creator, facts, then the body block for block — the
 * translations are made that way), so the position carries by index. Null
 * when that was the last block.
 */
export function stepAfterSwitch(current: number, newLength: number): number | null {
  const next = current + 1;
  return next < newLength ? next : null;
}
